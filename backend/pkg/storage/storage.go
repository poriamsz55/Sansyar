package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"sansyar/backend/pkg/config"
)

var allowedContentTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

type Service struct {
	endpoint  string
	bucket    string
	accessKey string
	secretKey string
	useSSL    bool
	publicURL string
	client    *http.Client
}

func NewService(cfg *config.Config) (*Service, error) {
	svc := &Service{
		endpoint:  cfg.MinIOEndpoint,
		bucket:    cfg.MinIOBucket,
		accessKey: cfg.MinIOAccessKey,
		secretKey: cfg.MinIOSecretKey,
		useSSL:    cfg.MinIOUseSSL,
		publicURL: strings.TrimRight(cfg.MinIOPublicURL, "/"),
		client:    &http.Client{Timeout: 60 * time.Second},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := svc.ensureBucket(ctx); err != nil {
		return nil, err
	}
	return svc, nil
}

func (s *Service) scheme() string {
	if s.useSSL {
		return "https"
	}
	return "http"
}

func (s *Service) ensureBucket(ctx context.Context) error {
	url := fmt.Sprintf("%s://%s/%s", s.scheme(), s.endpoint, s.bucket)
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	if err != nil {
		return err
	}
	s.sign(req, "", "us-east-1")
	res, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("minio bucket check: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusOK {
		return s.setPublicReadPolicy(ctx)
	}

	putReq, err := http.NewRequestWithContext(ctx, http.MethodPut, url, nil)
	if err != nil {
		return err
	}
	s.sign(putReq, "", "us-east-1")
	putRes, err := s.client.Do(putReq)
	if err != nil {
		return fmt.Errorf("minio create bucket: %w", err)
	}
	defer putRes.Body.Close()
	if putRes.StatusCode >= 300 {
		return fmt.Errorf("minio create bucket: status %d", putRes.StatusCode)
	}
	return s.setPublicReadPolicy(ctx)
}

func (s *Service) setPublicReadPolicy(ctx context.Context) error {
	policy := fmt.Sprintf(`{
		"Version": "2012-10-17",
		"Statement": [{
			"Effect": "Allow",
			"Principal": {"AWS": ["*"]},
			"Action": ["s3:GetObject"],
			"Resource": ["arn:aws:s3:::%s/*"]
		}]
	}`, s.bucket)
	// The subresource must be signed as "policy=" (SigV4 canonicalises a valueless
	// query key with a trailing "="). Using bare "?policy" makes the signature MinIO
	// computes differ from ours, so the request is rejected and the bucket never goes
	// public — which surfaces later as a 403 when serving objects.
	url := fmt.Sprintf("%s://%s/%s?policy=", s.scheme(), s.endpoint, s.bucket)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, strings.NewReader(policy))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	s.sign(req, hashHex([]byte(policy)), "us-east-1")
	res, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("minio bucket policy: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("minio bucket policy: status %d: %s", res.StatusCode, string(body))
	}
	return nil
}

func (s *Service) Upload(ctx context.Context, reader io.Reader, size int64, contentType string, folder string) (string, error) {
	ext, ok := allowedContentTypes[contentType]
	if !ok {
		return "", fmt.Errorf("unsupported content type: %s", contentType)
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	folder = strings.Trim(folder, "/")
	objectKey := fmt.Sprintf("%s/%s%s", folder, uuid.NewString(), ext)
	url := fmt.Sprintf("%s://%s/%s/%s", s.scheme(), s.endpoint, s.bucket, objectKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", contentType)
	req.ContentLength = int64(len(data))
	s.sign(req, hashHex(data), "us-east-1")

	res, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("minio upload: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		body, _ := io.ReadAll(res.Body)
		return "", fmt.Errorf("minio upload: status %d: %s", res.StatusCode, string(body))
	}

	return fmt.Sprintf("%s/%s", s.publicURL, objectKey), nil
}

func (s *Service) Delete(ctx context.Context, objectURL string) error {
	prefix := s.publicURL + "/"
	if !strings.HasPrefix(objectURL, prefix) {
		return nil
	}
	objectKey := strings.TrimPrefix(objectURL, prefix)
	url := fmt.Sprintf("%s://%s/%s/%s", s.scheme(), s.endpoint, s.bucket, objectKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	s.sign(req, "", "us-east-1")
	res, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	return nil
}

func (s *Service) sign(req *http.Request, payloadHash string, region string) {
	if payloadHash == "" {
		payloadHash = hashHex([]byte{})
	}
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	req.Header.Set("Host", s.endpoint)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)

	canonicalURI := req.URL.Path
	if canonicalURI == "" {
		canonicalURI = "/"
	}

	signedHeaders := []string{"host", "x-amz-content-sha256", "x-amz-date"}
	if ct := req.Header.Get("Content-Type"); ct != "" {
		signedHeaders = append(signedHeaders, "content-type")
	}
	sort.Strings(signedHeaders)

	var canonicalHeaders strings.Builder
	for _, h := range signedHeaders {
		val := ""
		switch h {
		case "host":
			val = s.endpoint
		case "content-type":
			val = strings.TrimSpace(req.Header.Get("Content-Type"))
		case "x-amz-content-sha256":
			val = payloadHash
		case "x-amz-date":
			val = amzDate
		}
		canonicalHeaders.WriteString(h)
		canonicalHeaders.WriteByte(':')
		canonicalHeaders.WriteString(val)
		canonicalHeaders.WriteByte('\n')
	}

	signedHeadersStr := strings.Join(signedHeaders, ";")
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI,
		req.URL.RawQuery,
		canonicalHeaders.String(),
		signedHeadersStr,
		payloadHash,
	}, "\n")

	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		hashHex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveSigningKey(s.secretKey, dateStamp, region, "s3")
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	auth := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		s.accessKey, credentialScope, signedHeadersStr, signature,
	)
	req.Header.Set("Authorization", auth)
}

func hashHex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}

func deriveSigningKey(secret, dateStamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}
