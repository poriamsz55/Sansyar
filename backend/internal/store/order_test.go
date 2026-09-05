package store

import "testing"

func TestCanTransitionOrder(t *testing.T) {
	legal := [][2]string{
		{OrderPendingPayment, OrderCancelled},
		{OrderPaid, OrderProcessing},
		{OrderPaid, OrderCancelled},
		{OrderProcessing, OrderShipped},
		{OrderProcessing, OrderCancelled},
		{OrderShipped, OrderDelivered},
	}
	for _, c := range legal {
		if !CanTransitionOrder(c[0], c[1]) {
			t.Fatalf("%s -> %s should be legal", c[0], c[1])
		}
	}

	illegal := [][2]string{
		{OrderPendingPayment, OrderPaid}, // only payment verification sets paid
		{OrderPendingPayment, OrderShipped},
		{OrderDelivered, OrderCancelled}, // terminal states
		{OrderCancelled, OrderProcessing},
		{OrderShipped, OrderProcessing}, // no backwards transitions
		{OrderPaid, OrderPaid},          // self transition
		{"", OrderPaid},
	}
	for _, c := range illegal {
		if CanTransitionOrder(c[0], c[1]) {
			t.Fatalf("%s -> %s should be illegal", c[0], c[1])
		}
	}
}
