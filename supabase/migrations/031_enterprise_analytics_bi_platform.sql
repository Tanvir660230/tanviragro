-- ============================================================================
-- Migration 031: Enterprise Analytics, BI & Executive Decision Platform
-- ============================================================================

-- 1. Analytics Dashboards (Role-based & Custom Exec Workspaces)
CREATE TABLE IF NOT EXISTS public.analytics_dashboards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role_slug           TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  is_default          BOOLEAN NOT NULL DEFAULT false,
  layout_config       JSONB NOT NULL DEFAULT '{"grid": "auto", "columns": 12, "spacing": 4}'::jsonb,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Analytics Widgets (High-Performance Modular Cards & Charts)
CREATE TABLE IF NOT EXISTS public.analytics_widgets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id        UUID NOT NULL REFERENCES public.analytics_dashboards(id) ON DELETE CASCADE,
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  widget_type         TEXT NOT NULL CHECK (
                        widget_type IN (
                          'kpi_card', 'line_chart', 'bar_chart', 'pie_chart', 'area_chart',
                          'scatter_plot', 'gauge', 'heatmap', 'pivot_table', 'data_table',
                          'forecast_card', 'alert_feed', 'calendar_view', 'tree_map'
                        )
                      ),
  data_source         TEXT NOT NULL,
  query_config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_x          INTEGER NOT NULL DEFAULT 0,
  position_y          INTEGER NOT NULL DEFAULT 0,
  width               INTEGER NOT NULL DEFAULT 6,
  height              INTEGER NOT NULL DEFAULT 4,
  refresh_interval_sec INTEGER NOT NULL DEFAULT 300,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Custom & Saved Reports Engine
CREATE TABLE IF NOT EXISTS public.custom_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL DEFAULT 'general' CHECK (
                        category IN ('executive', 'financial', 'livestock', 'health', 'feed_nutrition', 'breeding', 'commerce', 'inventory', 'governance', 'general')
                      ),
  dataset             TEXT NOT NULL,
  config              JSONB NOT NULL DEFAULT '{"fields": [], "filters": [], "groups": [], "aggregations": [], "sorting": [], "chart_type": "table"}'::jsonb,
  is_public           BOOLEAN NOT NULL DEFAULT false,
  is_template         BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Automated Report Schedules & Multi-Channel Broadcasts
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  report_id           UUID REFERENCES public.custom_reports(id) ON DELETE CASCADE,
  report_type         TEXT NOT NULL DEFAULT 'custom' CHECK (
                        report_type IN ('custom', 'financial_statement', 'executive_summary', 'herd_health', 'feed_efficiency', 'reproduction_audit', 'commerce_daily')
                      ),
  frequency           TEXT NOT NULL CHECK (
                        frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')
                      ),
  day_of_week         INTEGER,
  day_of_month        INTEGER,
  hour_of_day         INTEGER NOT NULL DEFAULT 6,
  format              TEXT NOT NULL DEFAULT 'pdf' CHECK (
                        format IN ('pdf', 'excel', 'csv', 'json')
                      ),
  recipients          TEXT[] NOT NULL DEFAULT '{}',
  channels            TEXT[] NOT NULL DEFAULT '{"email"}',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_run_at         TIMESTAMPTZ,
  next_run_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Analytics Daily / Weekly Snapshots (Historical BI Caching & Trend Acceleration)
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  snapshot_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  role_slug           TEXT NOT NULL DEFAULT 'executive',
  metrics_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, snapshot_date, role_slug)
);

-- 6. Configurable KPI & Automated Alert Rules Engine
CREATE TABLE IF NOT EXISTS public.analytics_alert_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  rule_name           TEXT NOT NULL,
  metric_key          TEXT NOT NULL,
  condition_operator  TEXT NOT NULL CHECK (
                        condition_operator IN ('>', '>=', '<', '<=', '==', '!=', 'trend_drop_pct', 'trend_spike_pct')
                      ),
  threshold_value     NUMERIC(14,2) NOT NULL,
  severity            TEXT NOT NULL DEFAULT 'high' CHECK (
                        severity IN ('critical', 'high', 'medium', 'low', 'info')
                      ),
  channels            TEXT[] NOT NULL DEFAULT '{"in_app"}',
  is_enabled          BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Compound Performance Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_biz_role ON public.analytics_dashboards(business_id, role_slug);
CREATE INDEX IF NOT EXISTS idx_analytics_widgets_dash_pos ON public.analytics_widgets(dashboard_id, position_y, position_x);
CREATE INDEX IF NOT EXISTS idx_analytics_widgets_biz ON public.analytics_widgets(business_id);
CREATE INDEX IF NOT EXISTS idx_custom_reports_biz_cat ON public.custom_reports(business_id, category);
CREATE INDEX IF NOT EXISTS idx_report_schedules_biz_active ON public.report_schedules(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_lookup ON public.analytics_snapshots(business_id, role_slug, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_alert_rules_biz ON public.analytics_alert_rules(business_id, is_enabled);

-- ── Enable Row Level Security (RLS) ──────────────────────────────────────────
ALTER TABLE public.analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_alert_rules ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for analytics_dashboards" ON public.analytics_dashboards;
CREATE POLICY "Tenant isolation for analytics_dashboards" ON public.analytics_dashboards
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for analytics_widgets" ON public.analytics_widgets;
CREATE POLICY "Tenant isolation for analytics_widgets" ON public.analytics_widgets
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for custom_reports" ON public.custom_reports;
CREATE POLICY "Tenant isolation for custom_reports" ON public.custom_reports
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for report_schedules" ON public.report_schedules;
CREATE POLICY "Tenant isolation for report_schedules" ON public.report_schedules
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for analytics_snapshots" ON public.analytics_snapshots;
CREATE POLICY "Tenant isolation for analytics_snapshots" ON public.analytics_snapshots
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Tenant isolation for analytics_alert_rules" ON public.analytics_alert_rules;
CREATE POLICY "Tenant isolation for analytics_alert_rules" ON public.analytics_alert_rules
  FOR ALL USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ============================================================================
-- ROLLBACK STRATEGY:
-- DROP TABLE IF EXISTS public.analytics_alert_rules CASCADE;
-- DROP TABLE IF EXISTS public.analytics_snapshots CASCADE;
-- DROP TABLE IF EXISTS public.report_schedules CASCADE;
-- DROP TABLE IF EXISTS public.custom_reports CASCADE;
-- DROP TABLE IF EXISTS public.analytics_widgets CASCADE;
-- DROP TABLE IF EXISTS public.analytics_dashboards CASCADE;
-- ============================================================================
