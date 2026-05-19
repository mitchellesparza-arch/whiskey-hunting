import { NextResponse } from 'next/server'
import { getMonitorState, desiredIntervalSeconds, isExpired } from '../../../../lib/reservebar.js'

/**
 * GET /api/reservebar-monitor/status
 *
 * Public health-check — no auth required.
 * Returns the last successful poll time and current state machine phase so the
 * user can verify the monitor is alive without waiting for the alert.
 */
export async function GET() {
  const enabled = process.env.RESERVEBAR_MONITOR_ENABLED === 'true'

  if (!enabled) {
    return NextResponse.json({ enabled: false, phase: null, lastPollAt: null })
  }

  try {
    const state = await getMonitorState()
    return NextResponse.json({
      enabled:           true,
      phase:             state.phase,
      lastPollAt:        state.lastPollAt,
      lastPollSignals:   state.lastPollSignals,
      alertFiredAt:      state.alertFiredAt,
      activeSince:       state.activeSince,
      expired:           isExpired(state.activeSince),
      consecutiveErrors: state.consecutiveErrors,
      currentInterval:   desiredIntervalSeconds(),
      directProductUrl:  state.directProductUrl ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
