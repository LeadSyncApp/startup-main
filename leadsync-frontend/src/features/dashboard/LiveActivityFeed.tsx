import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Box, MessageSquareText, ShoppingBag, Sparkles } from 'lucide-react';
import { getSocket } from '../../lib/socketClient';

interface FeedEvent {
  id: string;
  type: 'order_created' | 'order_updated' | 'payment_confirmed' | 'lead_updated';
  title: string;
  body: string;
  createdAt: string;
  leadId?: string;
  orderId?: string;
  conversationId?: string;
  payload?: any;
}

const MAX_VISIBLE = 8;
const MAX_BUFFER = 50;
const FLUSH_INTERVAL_MS = 250;

function formatEventTime(date: string) {
  try {
    return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const LiveActivityFeed: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState<FeedEvent[]>([]);
  const [hovered, setHovered] = useState(false);
  const bufferRef = useRef<FeedEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  const pushEvent = (event: FeedEvent) => {
    bufferRef.current = [event, ...bufferRef.current].slice(0, MAX_BUFFER);
  };

  const flushBuffer = () => {
    if (bufferRef.current.length === 0) return;
    setEvents((prev) => {
      const merged = [...bufferRef.current, ...prev].slice(0, MAX_VISIBLE);
      return merged;
    });
    setPendingEvents([]);
    bufferRef.current = [];
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleEvent = (eventType: FeedEvent['type']) => (payload: any) => {
      const event = buildEvent(eventType, payload);
      if (!event) return;
      pushEvent(event);
      if (!hovered) {
        setPendingEvents((prev) => {
          const next = [event, ...prev].slice(0, 3);
          return next;
        });
      }
    };

    const handlers = [
      ['order_created', handleEvent('order_created')],
      ['order_updated', handleEvent('order_updated')],
      ['payment_confirmed', handleEvent('payment_confirmed')],
      ['lead_updated', handleEvent('lead_updated')],
    ] as const;

    handlers.forEach(([name, handler]) => {
      socket.on(name, handler);
    });

    flushTimerRef.current = window.setInterval(() => {
      if (!hovered) {
        flushBuffer();
      }
    }, FLUSH_INTERVAL_MS);

    return () => {
      handlers.forEach(([name, handler]) => {
        socket.off(name, handler);
      });
      if (flushTimerRef.current) {
        window.clearInterval(flushTimerRef.current);
      }
    };
  }, [hovered]);

  useEffect(() => {
    if (hovered) return;
    if (pendingEvents.length > 0) {
      flushBuffer();
    }
  }, [hovered, pendingEvents]);

  const handleClick = (event: FeedEvent) => {
    const targetLeadId = event.leadId || event.payload?.leadId || event.payload?.lead?.id;
    if (event.type === 'lead_updated' && targetLeadId) {
      navigate(`/inbox/${targetLeadId}`);
      return;
    }

    if (targetLeadId) {
      navigate(`/inbox/${targetLeadId}`);
      return;
    }
  };

  const recentEvents = useMemo(() => events.slice(0, MAX_VISIBLE), [events]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--brand-saffron)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Live Activity</h3>
        </div>
        {pendingEvents.length > 0 && (
          <button
            type="button"
            onClick={() => {
              flushBuffer();
              setPendingEvents([]);
            }}
            className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)]"
          >
            {pendingEvents.length} new updates
          </button>
        )}
      </div>

      <div
        className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          if (pendingEvents.length > 0) {
            flushBuffer();
            setPendingEvents([]);
          }
        }}
      >
        {recentEvents.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--app-border)] p-3 text-sm text-[var(--app-text-muted)]">
            <BellRing className="h-4 w-4" />
            Waiting for live activity...
          </div>
        ) : (
          <>
            {recentEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => handleClick(event)}
                className="w-full text-left rounded-xl border border-[var(--app-border)] bg-[var(--app-bg-soft)] px-3 py-2.5 transition hover:border-[var(--brand-saffron)] hover:bg-[var(--brand-saffron-soft)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="mt-0.5 rounded-lg bg-[var(--brand-saffron-soft)] p-1.5 text-[var(--brand-saffron)]">
                      {event.type === 'lead_updated' ? <MessageSquareText className="h-3.5 w-3.5" /> : event.type === 'payment_confirmed' ? <ShoppingBag className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{event.title}</div>
                      <div className="text-xs text-[var(--app-text-muted)] line-clamp-2">{event.body}</div>
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)] whitespace-nowrap">
                    {formatEventTime(event.createdAt)}
                  </div>
                </div>
              </button>
            ))}
            {events.length > MAX_VISIBLE && (
              <div className="px-2 pt-1 text-[11px] font-medium text-[var(--app-text-muted)]">
                +{events.length - MAX_VISIBLE} earlier today
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function buildEvent(type: FeedEvent['type'], payload: any): FeedEvent | null {
  if (!payload) return null;

  switch (type) {
    case 'order_created': {
      const order = payload.order || payload;
      return {
        id: `${type}-${order?.id || Math.random().toString(36).slice(2)}`,
        type,
        title: 'New order received',
        body: order?.summary || 'A new order was created',
        createdAt: order?.createdAt || new Date().toISOString(),
        leadId: order?.leadId || payload?.leadId || payload?.lead?.id,
        orderId: order?.id,
        conversationId: payload?.conversationId || order?.conversationId,
        payload,
      };
    }
    case 'order_updated': {
      const order = payload.order || payload;
      return {
        id: `${type}-${order?.id || Math.random().toString(36).slice(2)}`,
        type,
        title: 'Order updated',
        body: order?.summary || 'An order changed status',
        createdAt: order?.updatedAt || order?.createdAt || new Date().toISOString(),
        leadId: order?.leadId || payload?.leadId || payload?.lead?.id,
        orderId: order?.id,
        conversationId: payload?.conversationId || order?.conversationId,
        payload,
      };
    }
    case 'payment_confirmed': {
      const order = payload.order || payload;
      return {
        id: `${type}-${order?.id || Math.random().toString(36).slice(2)}`,
        type,
        title: 'Payment received',
        body: order?.summary || 'Payment was confirmed',
        createdAt: order?.updatedAt || order?.createdAt || new Date().toISOString(),
        leadId: order?.leadId || payload?.leadId || payload?.lead?.id,
        orderId: order?.id,
        conversationId: payload?.conversationId || order?.conversationId,
        payload,
      };
    }
    case 'lead_updated': {
      const leadId = payload?.leadId || payload?.id;
      return {
        id: `${type}-${leadId || Math.random().toString(36).slice(2)}`,
        type,
        title: 'Lead activity',
        body: payload?.pendingOrderSummary || 'A lead update was received',
        createdAt: payload?.updatedAt || new Date().toISOString(),
        leadId,
        payload,
      };
    }
    default:
      return null;
  }
}
