--
-- PostgreSQL database dump
--

\restrict i8gpBPaGg208sqox1vTjxBqlOUQMrV6SxAfYhZlAhYMmIhxe6gvEgS5oqMwDtGl

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.12 (Ubuntu 17.12-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: _enrich_metrics(jsonb, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._enrich_metrics(p_stats jsonb, p_global_avg numeric, p_c numeric DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE v_out jsonb := '[]'::jsonb; v_row jsonb; v_count int; v_pct int; v_succ int; v_numeric numeric;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_stats) LOOP
    v_count := (v_row->>'count')::int;
    v_pct := (v_row->>'percentage')::int;
    v_succ := COALESCE((v_row->>'success_count')::int, 0);

    -- Bayesian
    v_numeric := ROUND((p_c * p_global_avg + v_count * v_pct) / (p_c + v_count));
    v_row := jsonb_set(v_row, '{bayesian_pct}', to_jsonb(v_numeric::int));

    -- Wilson LB (95% CI)
    IF v_count > 0 THEN
      v_numeric := ROUND(
        (
          (v_succ::numeric / v_count) +
          (1.96*1.96)/(2.0*v_count) -
          1.96 * SQRT(
            ((v_succ::numeric / v_count) * (1 - v_succ::numeric/v_count) + (1.96*1.96)/(4.0*v_count)) / v_count
          )
        ) / (1 + (1.96*1.96)/v_count) * 100
      );
      IF v_numeric < 0 THEN v_numeric := 0; END IF;
    ELSE
      v_numeric := 0;
    END IF;
    v_row := jsonb_set(v_row, '{wilson_lb}', to_jsonb(v_numeric::int));

    v_out := v_out || v_row;
  END LOOP;
  RETURN v_out;
END; $$;


--
-- Name: _get_global_avg(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._get_global_avg(p_start date, p_end date, p_date_type text) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0)), 0)
  FROM audit_units_flat
  WHERE score_value IS NOT NULL
    AND ((p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
      OR (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end)));
$$;


--
-- Name: audit_user_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_user_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- تغيير الإيميل: مزامنة + تسجيل
    IF OLD.email IS DISTINCT FROM NEW.email THEN
        UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;

        INSERT INTO public.audit_log (user_id, user_email, action, description, severity, metadata)
        VALUES (NEW.id, NEW.email, 'email_changed',
                'تم تغيير البريد الإلكتروني', 'warning',
                jsonb_build_object('old_email', OLD.email, 'new_email', NEW.email));
    END IF;

    -- تغيير الباسورد
    IF OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password THEN
        INSERT INTO public.audit_log (user_id, user_email, action, description, severity)
        VALUES (NEW.id, NEW.email, 'password_changed',
                'قام بتغيير كلمة المرور', 'warning');
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: clean_reviewer_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clean_reviewer_name(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT public.normalize_arabic_name(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(SPLIT_PART(COALESCE(p, ''), '-', 1)),
        '^(Dr\.?\s*[/\\]?\s*|Doctor\s+|Dr\s+)', '', 'i'
      ),
      '^(د\.?\s*[/\\]?\s*|دكتور\s+|دكتورة\s+)', '', 'i'
    )
  );
$$;


--
-- Name: cleanup_old_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_sessions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_deleted int;
BEGIN
  DELETE FROM public.user_sessions
  WHERE is_active = false
    AND ended_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;


--
-- Name: create_session(text, jsonb, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_session(p_device_id text, p_device_info jsonb DEFAULT '{}'::jsonb, p_duration_hours integer DEFAULT 15, p_user_agent text DEFAULT NULL::text, p_ip text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_token text := gen_random_uuid()::text;
  v_expires timestamptz := now() + (interval '1 hour' * p_duration_hours);
  v_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  INSERT INTO public.user_sessions
    (user_id, session_token, device_id, device_info, user_agent, ip_address, expires_at)
  VALUES
    (v_user_id, v_session_token, p_device_id, p_device_info, p_user_agent, p_ip, v_expires)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_id,
    'session_token', v_session_token,
    'expires_at', v_expires,
    'duration_hours', p_duration_hours
  );
END $$;


--
-- Name: end_session(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.end_session(p_session_token text, p_reason text DEFAULT 'logout'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE public.user_sessions
  SET is_active = false, ended_at = now(), ended_reason = p_reason
  WHERE session_token = p_session_token AND user_id = v_user_id AND is_active = true;
  RETURN FOUND;
END $$;


--
-- Name: get_active_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_active_sessions() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'session_token', session_token,
    'device_id', device_id,
    'device_info', device_info,
    'user_agent', user_agent,
    'started_at', started_at,
    'expires_at', expires_at,
    'last_seen_at', last_seen_at
  ) ORDER BY started_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.user_sessions
  WHERE user_id = v_user_id
    AND is_active = true
    AND expires_at > now();

  RETURN v_result;
END $$;


--
-- Name: get_all_issue_labels(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_issue_labels() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(jsonb_object_agg(code, label), '{}'::jsonb)
  FROM public.issue_catalog
  WHERE is_active = true;
$$;


--
-- Name: get_clerks_stats(date, date, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_clerks_stats(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text, p_sort_by text DEFAULT 'bayesian'::text, p_min_count integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_global numeric; v_result jsonb; v_order text;
BEGIN
  v_global := _get_global_avg(p_start, p_end, p_date_type);
  WITH base AS (
    SELECT * FROM audit_units_flat
    WHERE role='clerk' AND score_value IS NOT NULL
      AND ((p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
        OR (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end)))
  ),
  matched AS (
    SELECT
      CASE WHEN is_ambiguous THEN 'خط / توقيع غير واضح' ELSE person_name END AS name,
      'غير محدد'::text AS specialty, 'غير محدد'::text AS department,
      COUNT(*)::int AS count, SUM(score_value)::int AS total_score,
      ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage,
      SUM(CASE WHEN score_value=2 THEN 1 ELSE 0 END)::int AS success_count,
      SUM(CASE WHEN score_value=1 THEN 1 ELSE 0 END)::int AS score1_count,
      SUM(CASE WHEN score_value=0 THEN 1 ELSE 0 END)::int AS score0_count
    FROM base GROUP BY 1 HAVING COUNT(*) >= p_min_count
  )
  SELECT _enrich_metrics(COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb), v_global)
  INTO v_result FROM matched c;

  v_order := CASE p_sort_by WHEN 'wilson' THEN 'wilson_lb' WHEN 'percentage' THEN 'percentage' WHEN 'count' THEN 'count' ELSE 'bayesian_pct' END;
  RETURN (
    SELECT jsonb_agg(elem ORDER BY
      CASE WHEN v_order='count' THEN (elem->>'count')::int ELSE (elem->>v_order)::int END DESC,
      (elem->>'count')::int DESC
    )
    FROM jsonb_array_elements(v_result) elem
  );
END; $$;


--
-- Name: get_comparison(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_comparison(p_type text, p_name text, p_month1 text, p_month2 text, p_month3 text, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_result jsonb := '[]'::jsonb; v_month text; v_s date; v_e date; v_item record;
BEGIN
  FOREACH v_month IN ARRAY ARRAY[p_month1, p_month2, p_month3] LOOP
    v_s := (v_month||'-01')::date;
    v_e := (DATE_TRUNC('month', v_s) + INTERVAL '1 month - 1 day')::date;
    WITH base AS (
      SELECT * FROM audit_units_flat
      WHERE score_value IS NOT NULL
        AND ((p_date_type='discharge' AND discharge_date BETWEEN v_s AND v_e)
          OR (p_date_type='timestamp' AND reviewed_at::date BETWEEN v_s AND v_e))
    ),
    matched AS (
      SELECT * FROM base b WHERE
        (p_type='doctors' AND role='doctor' AND person_norm=normalize_arabic_name(p_name))
        OR (p_type='nurses' AND role='nurse' AND person_norm=normalize_arabic_name(p_name))
        OR (p_type='clerks' AND role='clerk' AND person_norm=normalize_arabic_name(p_name))
        OR (p_type='forms' AND form_text=p_name)
        OR (p_type='departments' AND role='doctor' AND EXISTS(
            SELECT 1 FROM doctors d WHERE normalize_arabic_name(d.name)=b.person_norm AND d.department_normalized=p_name))
    )
    SELECT COUNT(*)::int AS cnt, COALESCE(SUM(score_value),0)::int AS total,
      COALESCE(ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0)),0)::int AS pct
    INTO v_item FROM matched;
    v_result := v_result || jsonb_build_object('month', v_month, 'count', v_item.cnt,
      'totalScore', v_item.total, 'percentage', v_item.pct);
  END LOOP;
  RETURN v_result;
END; $$;


--
-- Name: get_departments_stats(date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_departments_stats(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text, p_sort_by text DEFAULT 'bayesian'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_global numeric; v_result jsonb; v_order text;
BEGIN
  v_global := _get_global_avg(p_start, p_end, p_date_type);
  WITH base AS (
    SELECT * FROM audit_units_flat
    WHERE role='doctor' AND score_value IS NOT NULL AND NOT is_ambiguous
      AND ((p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
        OR (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end)))
  ),
  matched AS (
    SELECT d.department_normalized AS name,
      NULL::text AS specialty, d.department_normalized AS department,
      COUNT(*)::int AS count, SUM(b.score_value)::int AS total_score,
      ROUND(SUM(b.score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage,
      SUM(CASE WHEN b.score_value=2 THEN 1 ELSE 0 END)::int AS success_count,
      SUM(CASE WHEN b.score_value=1 THEN 1 ELSE 0 END)::int AS score1_count,
      SUM(CASE WHEN b.score_value=0 THEN 1 ELSE 0 END)::int AS score0_count
    FROM base b JOIN doctors d ON normalize_arabic_name(d.name)=b.person_norm
    WHERE d.department_normalized IS NOT NULL AND COALESCE(d.role,'') <> 'consultant'
    GROUP BY d.department_normalized
  )
  SELECT _enrich_metrics(COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb), v_global)
  INTO v_result FROM matched c;

  v_order := CASE p_sort_by WHEN 'percentage' THEN 'percentage' WHEN 'count' THEN 'count' ELSE 'bayesian_pct' END;
  RETURN (
    SELECT jsonb_agg(elem ORDER BY
      CASE WHEN v_order='count' THEN (elem->>'count')::int ELSE (elem->>v_order)::int END DESC
    )
    FROM jsonb_array_elements(v_result) elem
  );
END; $$;


--
-- Name: get_dept_group(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_dept_group(p_dept text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE 
    WHEN p_dept IS NULL OR TRIM(p_dept) = '' THEN 'غير محدد'
    WHEN p_dept LIKE '%جودة%' THEN 'جودة'
    WHEN p_dept LIKE '%سجل%' OR UPPER(p_dept) LIKE '%MRD%' THEN 'سجلات'
    ELSE 'أخرى'
  END;
$$;


--
-- Name: get_doctors_stats(date, date, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_doctors_stats(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text, p_sort_by text DEFAULT 'bayesian'::text, p_min_count integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_global numeric; v_result jsonb; v_order text;
BEGIN
  v_global := _get_global_avg(p_start, p_end, p_date_type);

  WITH base AS (
    SELECT * FROM audit_units_flat
    WHERE role='doctor' AND score_value IS NOT NULL
      AND ((p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
        OR (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end)))
  ),
  matched AS (
    SELECT d.name, d.specialty, d.department_normalized AS department,
      COUNT(*)::int AS count,
      SUM(b.score_value)::int AS total_score,
      ROUND(SUM(b.score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage,
      SUM(CASE WHEN b.score_value=2 THEN 1 ELSE 0 END)::int AS success_count,
      SUM(CASE WHEN b.score_value=1 THEN 1 ELSE 0 END)::int AS score1_count,
      SUM(CASE WHEN b.score_value=0 THEN 1 ELSE 0 END)::int AS score0_count
    FROM base b
    JOIN doctors d ON normalize_arabic_name(d.name) = b.person_norm
    WHERE NOT b.is_ambiguous AND COALESCE(d.role,'') <> 'consultant' AND d.department_normalized IS NOT NULL
    GROUP BY d.name, d.specialty, d.department_normalized
    HAVING COUNT(*) >= p_min_count
  ),
  ambig AS (
    SELECT 'خط / توقيع غير واضح' AS name, 'غير محدد' AS specialty, 'غير محدد' AS department,
      COUNT(*)::int AS count, SUM(score_value)::int AS total_score,
      ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage,
      SUM(CASE WHEN score_value=2 THEN 1 ELSE 0 END)::int AS success_count,
      SUM(CASE WHEN score_value=1 THEN 1 ELSE 0 END)::int AS score1_count,
      SUM(CASE WHEN score_value=0 THEN 1 ELSE 0 END)::int AS score0_count
    FROM base WHERE is_ambiguous
    HAVING COUNT(*) >= p_min_count
  ),
  combined AS (SELECT * FROM matched UNION ALL SELECT * FROM ambig)
  SELECT _enrich_metrics(COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb), v_global)
  INTO v_result FROM combined c;

  v_order := CASE p_sort_by
    WHEN 'wilson'     THEN 'wilson_lb'
    WHEN 'percentage' THEN 'percentage'
    WHEN 'count'      THEN 'count'
    ELSE 'bayesian_pct'
  END;

  RETURN (
    SELECT jsonb_agg(elem ORDER BY
      CASE WHEN v_order='count' THEN (elem->>'count')::int ELSE (elem->>v_order)::int END DESC,
      (elem->>'count')::int DESC
    )
    FROM jsonb_array_elements(v_result) elem
  );
END; $$;


--
-- Name: get_forms_stats(date, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_forms_stats(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text, p_sort_by text DEFAULT 'bayesian'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_global numeric; v_result jsonb; v_order text;
BEGIN
  v_global := _get_global_avg(p_start, p_end, p_date_type);
  WITH base AS (
    SELECT * FROM audit_units_flat
    WHERE score_value IS NOT NULL AND form_text IS NOT NULL AND form_text <> ''
      AND ((p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
        OR (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end)))
  ),
  matched AS (
    SELECT form_text AS name, form_id, NULL::text AS specialty, NULL::text AS department,
      COUNT(*)::int AS count, SUM(score_value)::int AS total_score,
      ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage,
      SUM(CASE WHEN score_value=2 THEN 1 ELSE 0 END)::int AS success_count,
      SUM(CASE WHEN score_value=1 THEN 1 ELSE 0 END)::int AS score1_count,
      SUM(CASE WHEN score_value=0 THEN 1 ELSE 0 END)::int AS score0_count
    FROM base GROUP BY form_text, form_id
  )
  SELECT _enrich_metrics(COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb), v_global)
  INTO v_result FROM matched c;

  v_order := CASE p_sort_by WHEN 'percentage' THEN 'percentage' WHEN 'count' THEN 'count' ELSE 'bayesian_pct' END;
  RETURN (
    SELECT jsonb_agg(elem ORDER BY
      CASE WHEN v_order='count' THEN (elem->>'count')::int ELSE (elem->>v_order)::int END DESC
    )
    FROM jsonb_array_elements(v_result) elem
  );
END; $$;


--
-- Name: get_item_details(text, text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_item_details(p_type text, p_name text, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_item jsonb; v_errors jsonb; v_top jsonb; v_bot jsonb;
BEGIN
  DROP TABLE IF EXISTS _matched;
  CREATE TEMP TABLE _matched ON COMMIT DROP AS
  SELECT * FROM audit_units_flat
  WHERE score_value IS NOT NULL
    AND (
      (p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
      OR
      (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end))
    )
    AND (
      -- Ambiguous aggregated card
      (p_name = 'خط / توقيع غير واضح' AND is_ambiguous AND (
          (p_type='doctor' AND role='doctor')
          OR (p_type='nurse' AND role='nurse')
          OR (p_type='clerk' AND role='clerk')
      ))
      OR
      -- Regular match
      (p_name <> 'خط / توقيع غير واضح' AND (
          (p_type='doctor' AND role='doctor' AND person_norm=normalize_arabic_name(p_name) AND NOT is_ambiguous)
          OR (p_type='nurse' AND role='nurse' AND person_norm=normalize_arabic_name(p_name) AND NOT is_ambiguous)
          OR (p_type='clerk' AND role='clerk' AND person_norm=normalize_arabic_name(p_name) AND NOT is_ambiguous)
          OR (p_type='form'  AND form_text=p_name)
          OR (p_type='department' AND role='doctor' AND EXISTS(
              SELECT 1 FROM doctors d WHERE normalize_arabic_name(d.name)=audit_units_flat.person_norm AND d.department_normalized=p_name))
      ))
    );

  SELECT jsonb_build_object('name', p_name,
    'count', COUNT(*), 'total_score', COALESCE(SUM(score_value),0),
    'percentage', COALESCE(ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0)),0)
  ) INTO v_item FROM _matched;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('error', code, 'count', cnt) ORDER BY cnt DESC),'[]'::jsonb)
  INTO v_errors FROM (
    SELECT UNNEST(issues) AS code, COUNT(*)::int AS cnt
    FROM _matched WHERE issues IS NOT NULL AND array_length(issues,1) > 0
    GROUP BY code ORDER BY cnt DESC LIMIT 10
  ) e;

  IF p_type='department' THEN
    WITH dd AS (
      SELECT person_name AS name, COUNT(*)::int AS count,
             SUM(score_value)::int AS total_score,
             ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage
      FROM _matched WHERE role='doctor' AND NOT is_ambiguous
      GROUP BY person_name
    )
    SELECT
      (SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (SELECT * FROM dd ORDER BY percentage DESC LIMIT 5) x),
      (SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (SELECT * FROM dd ORDER BY percentage ASC  LIMIT 5) x)
    INTO v_top, v_bot;
  END IF;

  RETURN jsonb_build_object('item', v_item, 'topErrors', v_errors,
    'topDoctors', COALESCE(v_top,'[]'::jsonb),
    'bottomDoctors', COALESCE(v_bot,'[]'::jsonb));
END; $$;


--
-- Name: get_monthly_trend(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_monthly_trend(p_months_back integer DEFAULT 12, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    WITH base AS (
      SELECT TO_CHAR(DATE_TRUNC('month',
        CASE WHEN p_date_type='discharge' THEN discharge_date ELSE reviewed_at::date END
      ), 'YYYY-MM') AS month, score_value
      FROM audit_units_flat
      WHERE score_value IS NOT NULL
        AND CASE WHEN p_date_type='discharge' THEN discharge_date ELSE reviewed_at::date END
            >= DATE_TRUNC('month', CURRENT_DATE) - (p_months_back-1) * INTERVAL '1 month'
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.month ASC),'[]'::jsonb)
    FROM (
      SELECT month, COUNT(*)::int AS count, SUM(score_value)::int AS total_score,
        ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage
      FROM base WHERE month IS NOT NULL GROUP BY month
    ) x
  );
END; $$;


--
-- Name: get_monthly_trend(integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_monthly_trend(p_months_back integer DEFAULT 12, p_date_type text DEFAULT 'discharge'::text, p_mode text DEFAULT 'units'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF p_mode = 'files' THEN
    RETURN (
      WITH per_file AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('month', CASE WHEN p_date_type='discharge' THEN discharge_date ELSE reviewed_at::date END), 'YYYY-MM') AS month,
          medical_id, visit_number,
          ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS file_pct
        FROM audit_units_flat
        WHERE score_value IS NOT NULL
          AND CASE WHEN p_date_type='discharge' THEN discharge_date ELSE reviewed_at::date END
              >= DATE_TRUNC('month', CURRENT_DATE) - (p_months_back-1) * INTERVAL '1 month'
        GROUP BY 1, 2, 3
      )
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.month ASC),'[]'::jsonb)
      FROM (
        SELECT month, 
          COUNT(*)::int AS count,
          ROUND(AVG(file_pct))::int AS percentage,
          SUM(file_pct)::int AS total_score
        FROM per_file WHERE month IS NOT NULL GROUP BY month
      ) x
    );
  ELSE
    RETURN (
      WITH base AS (
        SELECT 
          TO_CHAR(DATE_TRUNC('month', CASE WHEN p_date_type='discharge' THEN discharge_date ELSE reviewed_at::date END), 'YYYY-MM') AS month, 
          score_value
        FROM audit_units_flat
        WHERE score_value IS NOT NULL
          AND CASE WHEN p_date_type='discharge' THEN discharge_date ELSE reviewed_at::date END
              >= DATE_TRUNC('month', CURRENT_DATE) - (p_months_back-1) * INTERVAL '1 month'
      )
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.month ASC),'[]'::jsonb)
      FROM (
        SELECT month, COUNT(*)::int AS count, SUM(score_value)::int AS total_score,
          ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage
        FROM base WHERE month IS NOT NULL GROUP BY month
      ) x
    );
  END IF;
END; $$;


--
-- Name: get_my_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_sessions() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'session_token', session_token,
    'device_id', device_id,
    'device_info', device_info,
    'ip_address', ip_address,
    'user_agent', user_agent,
    'started_at', started_at,
    'expires_at', expires_at,
    'last_seen_at', last_seen_at,
    'is_active', is_active,
    'ended_reason', ended_reason,
    'ended_at', ended_at
  ) ORDER BY started_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.user_sessions
  WHERE user_id = v_user_id
    AND (is_active = true OR ended_at > now() - interval '7 days');

  RETURN v_result;
END $$;


--
-- Name: get_nurses_stats(date, date, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_nurses_stats(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text, p_sort_by text DEFAULT 'bayesian'::text, p_min_count integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_global numeric; v_result jsonb; v_order text;
BEGIN
  v_global := _get_global_avg(p_start, p_end, p_date_type);
  WITH base AS (
    SELECT * FROM audit_units_flat
    WHERE role='nurse' AND score_value IS NOT NULL
      AND ((p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
        OR (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end)))
  ),
  matched AS (
    SELECT
      CASE WHEN is_ambiguous THEN 'خط / توقيع غير واضح' ELSE person_name END AS name,
      'غير محدد'::text AS specialty, 'غير محدد'::text AS department,
      COUNT(*)::int AS count, SUM(score_value)::int AS total_score,
      ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0))::int AS percentage,
      SUM(CASE WHEN score_value=2 THEN 1 ELSE 0 END)::int AS success_count,
      SUM(CASE WHEN score_value=1 THEN 1 ELSE 0 END)::int AS score1_count,
      SUM(CASE WHEN score_value=0 THEN 1 ELSE 0 END)::int AS score0_count
    FROM base GROUP BY 1 HAVING COUNT(*) >= p_min_count
  )
  SELECT _enrich_metrics(COALESCE(jsonb_agg(to_jsonb(c)),'[]'::jsonb), v_global)
  INTO v_result FROM matched c;

  v_order := CASE p_sort_by WHEN 'wilson' THEN 'wilson_lb' WHEN 'percentage' THEN 'percentage' WHEN 'count' THEN 'count' ELSE 'bayesian_pct' END;
  RETURN (
    SELECT jsonb_agg(elem ORDER BY
      CASE WHEN v_order='count' THEN (elem->>'count')::int ELSE (elem->>v_order)::int END DESC,
      (elem->>'count')::int DESC
    )
    FROM jsonb_array_elements(v_result) elem
  );
END; $$;


--
-- Name: get_overview_stats(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_overview_stats(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    WITH base AS (
      SELECT * FROM audit_units_flat
      WHERE score_value IS NOT NULL
        AND ((p_date_type='discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
          OR (p_date_type='timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end)))
    )
    SELECT jsonb_build_object(
      'total_units',   (SELECT COUNT(*) FROM base),
      'total_reviews', (SELECT COUNT(DISTINCT medical_id||'|'||visit_number) FROM base),
      'total_doctors', (SELECT COUNT(DISTINCT person_norm) FROM base WHERE role='doctor' AND NOT is_ambiguous),
      'total_nurses',  (SELECT COUNT(DISTINCT person_norm) FROM base WHERE role='nurse' AND NOT is_ambiguous),
      'total_clerks',  (SELECT COUNT(DISTINCT person_norm) FROM base WHERE role='clerk' AND NOT is_ambiguous),
      'total_forms',   (SELECT COUNT(DISTINCT form_text) FROM base WHERE form_text IS NOT NULL),
      'overall_pct',   (SELECT COALESCE(ROUND(SUM(score_value)*100.0/NULLIF(COUNT(*)*2,0)),0) FROM base)
    )
  );
END; $$;


--
-- Name: get_quality_all_specialties(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_all_specialties() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT COALESCE(jsonb_agg(DISTINCT specialty ORDER BY specialty), '[]'::jsonb)
  FROM v_file_quality
  WHERE specialty IS NOT NULL AND specialty <> 'غير محدد';
$$;


--
-- Name: get_quality_compare(text, text, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_compare(p_reviewer1 text, p_reviewer2 text, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_r1 jsonb;
  v_r2 jsonb;
  v_daily jsonb;
  v_r1_norm text := public.clean_reviewer_name(p_reviewer1);
  v_r2_norm text := public.clean_reviewer_name(p_reviewer2);
BEGIN
  SELECT jsonb_build_object(
    'name', p_reviewer1,
    'total_files', COUNT(*),
    'avg_quality', COALESCE(ROUND(AVG(quality_pct))::int, 0)
  ) INTO v_r1
  FROM v_file_quality
  WHERE public.clean_reviewer_name(reviewer_name) = v_r1_norm
    AND (
      (p_date_type = 'discharge'
        AND (p_start IS NULL OR discharge_date >= p_start)
        AND (p_end IS NULL OR discharge_date <= p_end))
      OR (p_date_type = 'timestamp'
        AND (p_start IS NULL OR reviewed_at::date >= p_start)
        AND (p_end IS NULL OR reviewed_at::date <= p_end))
    );

  SELECT jsonb_build_object(
    'name', p_reviewer2,
    'total_files', COUNT(*),
    'avg_quality', COALESCE(ROUND(AVG(quality_pct))::int, 0)
  ) INTO v_r2
  FROM v_file_quality
  WHERE public.clean_reviewer_name(reviewer_name) = v_r2_norm
    AND (
      (p_date_type = 'discharge'
        AND (p_start IS NULL OR discharge_date >= p_start)
        AND (p_end IS NULL OR discharge_date <= p_end))
      OR (p_date_type = 'timestamp'
        AND (p_start IS NULL OR reviewed_at::date >= p_start)
        AND (p_end IS NULL OR reviewed_at::date <= p_end))
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', day_date,
    'r1', r1_count,
    'r2', r2_count
  ) ORDER BY day_date), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      COALESCE(r1.d, r2.d) AS day_date,
      COALESCE(r1.cnt, 0)::int AS r1_count,
      COALESCE(r2.cnt, 0)::int AS r2_count
    FROM (
      SELECT
        CASE WHEN p_date_type = 'discharge' THEN discharge_date ELSE reviewed_at::date END AS d,
        COUNT(*) AS cnt
      FROM v_file_quality
      WHERE public.clean_reviewer_name(reviewer_name) = v_r1_norm
      GROUP BY 1
    ) r1
    FULL OUTER JOIN (
      SELECT
        CASE WHEN p_date_type = 'discharge' THEN discharge_date ELSE reviewed_at::date END AS d,
        COUNT(*) AS cnt
      FROM v_file_quality
      WHERE public.clean_reviewer_name(reviewer_name) = v_r2_norm
      GROUP BY 1
    ) r2 ON r1.d = r2.d
    WHERE COALESCE(r1.d, r2.d) IS NOT NULL
      AND (p_start IS NULL OR COALESCE(r1.d, r2.d) >= p_start)
      AND (p_end IS NULL OR COALESCE(r1.d, r2.d) <= p_end)
    ORDER BY 1
  ) sub;

  RETURN jsonb_build_object(
    'reviewer1', COALESCE(v_r1, jsonb_build_object('name', p_reviewer1, 'total_files', 0, 'avg_quality', 0)),
    'reviewer2', COALESCE(v_r2, jsonb_build_object('name', p_reviewer2, 'total_files', 0, 'avg_quality', 0)),
    'daily', v_daily
  );
END $$;


--
-- Name: get_quality_daily(text, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_daily(p_reviewer_name text, p_start date, p_end date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_target text := clean_reviewer_name(p_reviewer_name);
BEGIN
  RETURN (
    WITH filtered AS (
      SELECT reviewed_at::date as day, COUNT(*) as cnt
      FROM v_file_quality
      WHERE clean_reviewer_name(reviewer_name) = v_target
        AND reviewed_at::date >= p_start
        AND reviewed_at::date <= p_end
      GROUP BY 1
    )
    SELECT jsonb_build_object(
      'dates', COALESCE(jsonb_agg(day ORDER BY day), '[]'::jsonb),
      'counts', COALESCE(jsonb_agg(cnt ORDER BY day), '[]'::jsonb)
    ) FROM filtered
  );
END; $$;


--
-- Name: get_quality_errors(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_errors(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    WITH filtered AS (
      SELECT medical_id, visit_number FROM v_file_quality
      WHERE (
        (p_date_type = 'discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
        OR (p_date_type = 'timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end))
      )
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.count DESC), '[]'::jsonb)
    FROM (
      SELECT UNNEST(au.issues) as issue, COUNT(*)::int as count
      FROM audit_units_flat au
      JOIN filtered f ON f.medical_id = au.medical_id AND f.visit_number = au.visit_number
      WHERE au.issues IS NOT NULL AND array_length(au.issues, 1) > 0
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 7
    ) e
  );
END; $$;


--
-- Name: get_quality_kpis(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_kpis(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_start date := COALESCE(p_start, '1900-01-01'::date);
    v_end date := COALESCE(p_end, '2100-01-01'::date);
    v_result jsonb;
BEGIN
    WITH base AS (
        SELECT
            reviewer_name,
            quality_pct,
            review_id,
            -- لو التاريخ فاضي، بنعتبره 1900-01-01 عشان ميتشالش من الفلتر
            CASE 
                WHEN p_date_type = 'discharge' THEN COALESCE(discharge_date, reviewed_at::date, '1900-01-01'::date)
                ELSE COALESCE(reviewed_at::date, discharge_date, '1900-01-01'::date)
            END AS effective_date
        FROM v_file_quality
        WHERE quality_pct IS NOT NULL
    ),
    filtered AS (
        SELECT * FROM base
        WHERE effective_date BETWEEN v_start AND v_end
    )
    SELECT jsonb_build_object(
        'total_reviewers', COALESCE(COUNT(DISTINCT reviewer_name), 0),
        'total_files', COALESCE(COUNT(DISTINCT review_id), 0),
        'working_days', COALESCE(COUNT(DISTINCT effective_date), 0),
        'avg_per_reviewer', COALESCE(ROUND(COUNT(DISTINCT review_id)::numeric / NULLIF(COUNT(DISTINCT reviewer_name), 0), 1), 0),
        'avg_quality', COALESCE(ROUND(AVG(quality_pct)), 0),
        'top_reviewer', (SELECT reviewer_name FROM filtered WHERE reviewer_name IS NOT NULL AND reviewer_name <> 'غير معروف' GROUP BY reviewer_name ORDER BY COUNT(*) DESC LIMIT 1)
    ) INTO v_result
    FROM filtered;
    
    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;


--
-- Name: get_quality_reviewer_details(text, date, date, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_reviewer_details(p_reviewer_name text, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_target text := clean_reviewer_name(p_reviewer_name);
  v_total int;
  v_avg int;
  v_offset int := (p_page - 1) * p_page_size;
  v_files jsonb;
  v_errors jsonb;
  v_total_errors int;
BEGIN
  DROP TABLE IF EXISTS _qf;
  CREATE TEMP TABLE _qf ON COMMIT DROP AS
  SELECT * FROM v_file_quality
  WHERE clean_reviewer_name(reviewer_name) = v_target
    AND (
      (p_date_type = 'discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
      OR (p_date_type = 'timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end))
    );

  SELECT COUNT(*), COALESCE(ROUND(AVG(quality_pct))::int, 0) INTO v_total, v_avg FROM _qf;

  SELECT jsonb_agg(to_jsonb(f)) INTO v_files FROM (
    SELECT medical_id, visit_number, quality_pct, specialty,
           COALESCE(discharge_date, reviewed_at::date) as file_date
    FROM _qf
    ORDER BY COALESCE(discharge_date, reviewed_at::date) DESC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) f;

  SELECT COUNT(*)::int INTO v_total_errors
  FROM audit_units_flat au
  JOIN _qf ON _qf.medical_id = au.medical_id AND _qf.visit_number = au.visit_number
  WHERE au.issues IS NOT NULL AND array_length(au.issues, 1) > 0;

  SELECT jsonb_agg(to_jsonb(e) ORDER BY e.count DESC) INTO v_errors FROM (
    SELECT UNNEST(au.issues) as error, COUNT(*)::int as count
    FROM audit_units_flat au
    JOIN _qf ON _qf.medical_id = au.medical_id AND _qf.visit_number = au.visit_number
    WHERE au.issues IS NOT NULL AND array_length(au.issues, 1) > 0
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 5
  ) e;

  RETURN jsonb_build_object(
    'files', COALESCE(v_files, '[]'::jsonb),
    'top_errors', COALESCE(v_errors, '[]'::jsonb),
    'total_files', v_total,
    'avg_quality', v_avg,
    'total_errors', v_total_errors,
    'pagination', jsonb_build_object(
      'page', p_page,
      'total_pages', GREATEST(CEIL(v_total::numeric / p_page_size)::int, 1),
      'has_prev', p_page > 1,
      'has_next', p_page < CEIL(v_total::numeric / p_page_size)
    )
  );
END; $$;


--
-- Name: get_quality_reviewers(date, date, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_reviewers(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text, p_sort_by text DEFAULT 'quality'::text, p_dept_group text DEFAULT 'all'::text, p_specialty text DEFAULT 'all'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_start date := COALESCE(p_start, '1900-01-01'::date);
    v_end date := COALESCE(p_end, '2100-01-01'::date);
BEGIN
    RETURN (
        WITH base AS (
            SELECT
                reviewer_name,
                reviewer_department,
                specialty,
                review_id,
                quality_pct,
                CASE WHEN p_date_type = 'discharge' THEN discharge_date ELSE reviewed_at::date END AS effective_date
            FROM v_file_quality
            WHERE quality_pct IS NOT NULL
        ),
        filtered AS (
            SELECT * FROM base
            WHERE effective_date BETWEEN v_start AND v_end
              AND (p_specialty = 'all' OR specialty = p_specialty)
        ),
        grouped AS (
            SELECT
                reviewer_name AS name,
                reviewer_department AS department,
                COUNT(DISTINCT review_id) AS file_count,
                ROUND(AVG(quality_pct)) AS quality_score,
                ROUND(COUNT(DISTINCT review_id)::numeric / NULLIF(COUNT(DISTINCT effective_date), 0), 2) AS efficiency
            FROM filtered
            WHERE reviewer_name IS NOT NULL
            GROUP BY reviewer_name, reviewer_department
        ),
        final AS (
            SELECT
                name,
                department,
                file_count,
                quality_score,
                efficiency,
                CASE
                    WHEN p_dept_group = 'all' THEN 'all'
                    WHEN p_dept_group = 'جودة' AND department ILIKE '%جودة%' THEN 'جودة'
                    WHEN p_dept_group = 'سجلات' AND department ILIKE '%سجلات%' THEN 'سجلات'
                    ELSE 'أخرى'
                END AS dept_group
            FROM grouped
        )
        SELECT COALESCE(jsonb_agg(row_to_json(f) ORDER BY f.file_count DESC), '[]'::jsonb)
        FROM final f
    );
END;
$$;


--
-- Name: get_quality_specialties(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_specialties(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    WITH filtered AS (
      SELECT specialty FROM v_file_quality
      WHERE specialty <> 'غير محدد'
        AND (
          (p_date_type = 'discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
          OR (p_date_type = 'timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end))
        )
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', specialty, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
    FROM (
      SELECT specialty, COUNT(*)::int as cnt
      FROM filtered GROUP BY specialty ORDER BY cnt DESC LIMIT 8
    ) x
  );
END; $$;


--
-- Name: get_quality_trend(date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quality_trend(p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date, p_date_type text DEFAULT 'discharge'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    WITH filtered AS (
      SELECT COALESCE(discharge_date, reviewed_at::date) as day,
             COUNT(*) as cnt, AVG(quality_pct) as avg_q
      FROM v_file_quality
      WHERE (
        (p_date_type = 'discharge' AND (p_start IS NULL OR discharge_date >= p_start) AND (p_end IS NULL OR discharge_date <= p_end))
        OR (p_date_type = 'timestamp' AND (p_start IS NULL OR reviewed_at::date >= p_start) AND (p_end IS NULL OR reviewed_at::date <= p_end))
      )
      GROUP BY 1
      HAVING COALESCE(discharge_date, reviewed_at::date) IS NOT NULL
    )
    SELECT jsonb_build_object(
      'dates', COALESCE(jsonb_agg(day ORDER BY day), '[]'::jsonb),
      'counts', COALESCE(jsonb_agg(cnt ORDER BY day), '[]'::jsonb),
      'quality', COALESCE(jsonb_agg(ROUND(avg_q)::int ORDER BY day), '[]'::jsonb)
    ) FROM filtered
  );
END; $$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND role IN ('super_admin','admin','reviewer_doctor')
); $$;


--
-- Name: is_ambiguous_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_ambiguous_name(p text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(p,'') = ''
      OR p ILIKE '%غير%واضح%' OR p ILIKE '%غير%معروف%'
      OR p ILIKE '%غير%موجود%' OR p ILIKE '%خط%غير%'
      OR p = '0' OR p = '-';
$$;


--
-- Name: is_catalog_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_catalog_admin() RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND role IN ('super_admin','admin','reviewer_doctor')
); $$;


--
-- Name: kill_session(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kill_session(p_session_token text, p_reason text DEFAULT 'manual'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  UPDATE public.user_sessions
  SET is_active = false, ended_at = now(), ended_reason = p_reason
  WHERE session_token = p_session_token AND user_id = v_user_id AND is_active = true;
  RETURN FOUND;
END $$;


--
-- Name: log_audit_event(text, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event(p_action text, p_entity_type text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb, p_severity text DEFAULT 'info'::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_log_id BIGINT;
    v_user_id UUID;
    v_email TEXT;
    v_role TEXT;
    v_user_agent TEXT;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NOT NULL THEN
        SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
        SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    END IF;

    -- استخراج user_agent من metadata لو موجود
    IF p_metadata ? 'user_agent' THEN
        v_user_agent := p_metadata->>'user_agent';
    END IF;

    INSERT INTO public.audit_log (
        user_id, user_email, user_role,
        action, entity_type, entity_id,
        description, metadata, user_agent, severity
    ) VALUES (
        v_user_id, v_email, v_role,
        p_action, p_entity_type, p_entity_id,
        p_description, COALESCE(p_metadata, '{}'::jsonb),
        v_user_agent, p_severity
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;


--
-- Name: normalize_arabic(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_arabic(t text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(COALESCE(t,''), '[أإآ]', 'ا', 'g'),
          'ة','ه','g'),
        'ى','ي','g'),
      '\s+',' ','g'), ''
  );
$$;


--
-- Name: normalize_arabic_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_arabic_name(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT REGEXP_REPLACE(
           REGEXP_REPLACE(
             REGEXP_REPLACE(
               REGEXP_REPLACE(LOWER(TRIM(COALESCE(p,''))), '[أإآ]', 'ا', 'g'),
               'ة', 'ه', 'g'),
             'ى', 'ي', 'g'),
           '\s+', ' ', 'g');
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: save_work_batch(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_work_batch(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_task jsonb; v_file jsonb; v_record_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_emp text := payload->>'name';
  v_notes text := COALESCE(payload->>'notes','');
  v_wdate date := (payload->>'workDate')::date;
BEGIN
  FOR v_task IN SELECT * FROM jsonb_array_elements(payload->'tasks') LOOP
    INSERT INTO work_records (batch_id, work_date, daily_exit_date, movement_type, employee_name, work_path, work_method, actual_count, models_count, notes, created_by)
    VALUES (
      v_batch_id, v_wdate,
      CASE WHEN v_task->>'workType'='ER' AND (v_task->>'dailyDate')<>'' THEN (v_task->>'dailyDate')::date ELSE NULL END,
      'تسجيل شغل', v_emp,
      CASE WHEN v_task->>'workMethod'='Other' THEN '-' ELSE v_task->>'workType' END,
      v_task->>'workMethod',
      COALESCE((v_task->>'count')::int,0),
      COALESCE((v_task->>'modelsCount')::int,0),
      v_notes, auth.uid()
    ) RETURNING id INTO v_record_id;

    IF v_task->>'workType' = 'Inpatient' THEN
      FOR v_file IN SELECT * FROM jsonb_array_elements(COALESCE(v_task->'dynFiles','[]'::jsonb)) LOOP
        INSERT INTO work_file_tracking (work_record_id, batch_id, mrn, patient_name, models_count, work_path, work_method, employee_name, daily_exit_date, work_date)
        VALUES (v_record_id, v_batch_id, v_file->>'mrn', v_file->>'name',
          COALESCE((v_file->>'mod')::int,0), 'Inpatient', v_task->>'workMethod',
          v_emp, (v_file->>'date')::date, v_wdate);
      END LOOP;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('status','success','batch_id', v_batch_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('status','error','message', SQLERRM);
END; $$;


--
-- Name: shift_form_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shift_form_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- منع التكرار اللانهائي (عشان ميدخلش في لوب)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- حالة إضافة نموذج جديد
  IF TG_OP = 'INSERT' AND NEW.order_index IS NOT NULL THEN
    UPDATE public.form_catalog
    SET order_index = order_index + 1
    WHERE order_index >= NEW.order_index;

  -- حالة تعديل رقم نموذج قديم
  ELSIF TG_OP = 'UPDATE' AND OLD.order_index IS DISTINCT FROM NEW.order_index AND NEW.order_index IS NOT NULL THEN
    IF NEW.order_index < OLD.order_index THEN
      -- لو اتحرك لفوق (رقم أصغر)، نزحزح اللي بينهم لتحت
      UPDATE public.form_catalog
      SET order_index = order_index + 1
      WHERE order_index >= NEW.order_index AND order_index < OLD.order_index AND id <> NEW.id;
    ELSIF NEW.order_index > OLD.order_index THEN
      -- لو اتحرك لتحت (رقم أكبر)، نزحزح اللي بينهم لفوق
      UPDATE public.form_catalog
      SET order_index = order_index - 1
      WHERE order_index > OLD.order_index AND order_index <= NEW.order_index AND id <> NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_audit_units(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_audit_units() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM audit_units_flat
    WHERE medical_id = OLD.medical_id AND visit_number = OLD.visit_number;
    RETURN OLD;
  END IF;

  DELETE FROM audit_units_flat
  WHERE medical_id = NEW.medical_id AND visit_number = NEW.visit_number;

  IF NEW.audit_questions IS NOT NULL THEN
    INSERT INTO audit_units_flat (
      review_id, medical_id, visit_number, discharge_date, reviewed_at,
      form_id, form_text, role, person_name, person_norm, is_ambiguous,
      score_value, issues, notes
    )
    SELECT
      NEW.id, -- ✅ التعديل هنا: استخدام ID المراجعة الحقيقي
      NEW.medical_id, NEW.visit_number, NEW.discharge_date, NEW.reviewed_at,
      f.val->>'formId', f.val->>'text',
      CASE u.val->>'role'
        WHEN 'doctor' THEN 'doctor'
        WHEN 'nurse' THEN 'nurse'
        WHEN 'admin' THEN 'clerk'
        WHEN 'Ward Clerk' THEN 'clerk'
        WHEN 'clerk' THEN 'clerk'
        ELSE NULL END,
      COALESCE(NULLIF(TRIM(u.val->>'person'),''), NULLIF(TRIM(u.val->>'otherName'),'')),
      normalize_arabic_name(COALESCE(u.val->>'person', u.val->>'otherName', '')),
      is_ambiguous_name(COALESCE(u.val->>'person', u.val->>'otherName', '')),
      CASE u.val->>'score'
        WHEN 'Score 2' THEN 2 WHEN 'مطابق' THEN 2
        WHEN 'Score 1' THEN 1 WHEN 'مطابق جزئي' THEN 1
        WHEN 'Score 0' THEN 0 WHEN 'غير مطابق' THEN 0
        ELSE NULL END,
      CASE WHEN jsonb_typeof(u.val->'issues')='array'
           THEN ARRAY(SELECT jsonb_array_elements_text(u.val->'issues'))
           WHEN jsonb_typeof(u.val->'issues')='string'
           THEN STRING_TO_ARRAY(u.val->>'issues', ',')
           ELSE ARRAY[]::text[] END,
      CASE WHEN jsonb_typeof(u.val->'notes')='array'
           THEN ARRAY(SELECT jsonb_array_elements_text(u.val->'notes'))
           WHEN jsonb_typeof(u.val->'notes')='string'
           THEN ARRAY[u.val->>'notes']
           ELSE ARRAY[]::text[] END
    FROM jsonb_array_elements(NEW.audit_questions) AS f(val),
         LATERAL jsonb_array_elements(COALESCE(f.val->'data','[]'::jsonb)) AS u(val)
    WHERE (u.val->>'score') IS NOT NULL
      AND (u.val->>'score') <> 'NA'
      AND (u.val->>'role') IS NOT NULL
      AND COALESCE(u.val->>'person', u.val->>'otherName', '') <> '';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: sync_doctor_dept(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_doctor_dept() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.department_normalized := COALESCE(
    (SELECT canonical FROM department_aliases WHERE alias = TRIM(COALESCE(NEW.department,''))),
    NULLIF(TRIM(NEW.department), '')
  );
  RETURN NEW;
END; $$;


--
-- Name: sync_file_specialty(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_file_specialty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_mid text := COALESCE(NEW.medical_id, OLD.medical_id);
  v_vn text := COALESCE(NEW.visit_number, OLD.visit_number);
  v_spec text;
BEGIN
  SELECT d.department_normalized INTO v_spec
  FROM audit_units_flat au
  JOIN doctors d ON normalize_arabic_name(d.name) = au.person_norm
  WHERE au.medical_id = v_mid AND au.visit_number = v_vn
    AND au.role = 'doctor' AND d.department_normalized IS NOT NULL
  GROUP BY d.department_normalized
  ORDER BY COUNT(*) DESC LIMIT 1;
  
  IF v_spec IS NOT NULL THEN
    INSERT INTO file_specialties (medical_id, visit_number, specialty)
    VALUES (v_mid, v_vn, v_spec)
    ON CONFLICT (medical_id, visit_number) DO UPDATE SET specialty = EXCLUDED.specialty;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END; $$;


--
-- Name: translate_issue_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.translate_issue_code(code text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(CASE code
    WHEN 'noSign' THEN 'بدون توقيع'
    WHEN 'noStamp' THEN 'بدون ختم'
    WHEN 'unclearSign' THEN 'توقيع غير واضح'
    WHEN 'noTime' THEN 'بدون وقت'
    WHEN 'noDate' THEN 'بدون تاريخ'
    WHEN 'noDiagnosis' THEN 'بدون تشخيص'
    WHEN 'unclearHandwriting' THEN 'خط غير واضح'
    WHEN 'incompleteData' THEN 'بيانات غير مكتملة'
    WHEN 'missingForm' THEN 'نموذج غير موجود'
    WHEN 'emptyForm' THEN 'نموذج فارغ'
    WHEN 'incompleteDiagnosis' THEN 'تشخيص غير مكتمل'
    WHEN 'patientRelativeSign' THEN 'توقيع المريض أو ذويه'
    WHEN 'treatment' THEN 'العلاج'
    WHEN 'bloodSugar' THEN 'نسبة السكر'
    WHEN 'heightWeight' THEN 'الطول/الوزن'
    WHEN 'vitalSigns' THEN 'العلامات الحيوية'
    WHEN 'medicalHistory' THEN 'التاريخ المرضي'
    WHEN 'incompleteassesment' THEN 'تقييم غير مكتمل'
    WHEN 'admissionType' THEN 'نوع الدخول'
    WHEN 'dischargeTime' THEN 'وقت الخروج'
    WHEN 'dischargeCondition' THEN 'الحالة عند الخروج'
    WHEN 'investigations' THEN 'الفحوصات'
    WHEN 'anesthesiaInfo' THEN 'معلومات التخدير'
    WHEN 'dietPlan' THEN 'النظام الغذائي'
    WHEN 'mobility' THEN 'الحركة'
    WHEN 'followUpDate' THEN 'موعد زيارة الطبيب'
    WHEN 'nationalId' THEN 'الرقم القومي'
    WHEN 'admissionTime' THEN 'وقت الدخول'
    WHEN 'allergyTest' THEN 'اختبار حساسية'
    WHEN 'vaccinationAssessment' THEN 'تقييم تطعيمات'
    WHEN 'medicationHistory' THEN 'التاريخ الدوائي'
    WHEN 'reAssessment' THEN 'إعادة التقييم'
    WHEN 'ecg' THEN 'رسم القلب'
    WHEN 'icuBedStatus' THEN 'الموقف من حجز سرير رعاية'
    WHEN 'consultationStatus' THEN 'الموقف من طلب الاستشارة'
    WHEN 'consentStatus' THEN 'الموقف من كتابة الموافقة'
    ELSE code END, code);
$$;


--
-- Name: update_form_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_form_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: update_review_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_review_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


--
-- Name: use_grace(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.use_grace(p_session_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sess record;
  v_new_expires timestamptz;
BEGIN
  SELECT * INTO v_sess FROM public.user_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_sess.grace_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'grace_already_used');
  END IF;

  UPDATE public.user_sessions
  SET expires_at = expires_at + interval '5 minutes',
      grace_used = true
  WHERE id = v_sess.id
  RETURNING expires_at INTO v_new_expires;

  RETURN jsonb_build_object('success', true, 'expires_at', v_new_expires);
END $$;


--
-- Name: validate_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_session(p_session_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sess record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_sess FROM public.user_sessions
  WHERE session_token = p_session_token AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF NOT v_sess.is_active THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'ended',
      'ended_reason', COALESCE(v_sess.ended_reason, 'unknown')
    );
  END IF;

  UPDATE public.user_sessions SET last_seen_at = now() WHERE id = v_sess.id;

  RETURN jsonb_build_object(
    'valid', true,
    'expires_at', v_sess.expires_at,
    'grace_used', v_sess.grace_used,
    'seconds_until_expiry',
      EXTRACT(EPOCH FROM (v_sess.expires_at - now()))::int
  );
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admission_type_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_type_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_catalog_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_catalog_map (
    app_id text NOT NULL,
    catalog_key text NOT NULL,
    is_enabled boolean DEFAULT true
);


--
-- Name: apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apps (
    id text NOT NULL,
    name text NOT NULL,
    icon text DEFAULT 'fa-cube'::text,
    description text,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    show_in_bar boolean DEFAULT true
);


--
-- Name: audit_error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_error_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    audit_record_id uuid,
    form_name text NOT NULL,
    error_code text NOT NULL,
    error_translation text NOT NULL,
    severity text DEFAULT 'medium'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_error_logs_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    user_id uuid,
    user_email text,
    user_role text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    user_agent text,
    severity text DEFAULT 'info'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_records (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    record_code text NOT NULL,
    patient_name text,
    doctor_name text,
    department_id uuid,
    audit_status text DEFAULT 'pending'::text,
    compliance_score integer DEFAULT 0,
    audited_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_records_audit_status_check CHECK ((audit_status = ANY (ARRAY['completed'::text, 'partial'::text, 'pending'::text, 'rejected'::text]))),
    CONSTRAINT audit_records_compliance_score_check CHECK (((compliance_score >= 0) AND (compliance_score <= 100)))
);


--
-- Name: audit_units_flat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_units_flat (
    id bigint NOT NULL,
    review_id uuid,
    medical_id text NOT NULL,
    visit_number text NOT NULL,
    discharge_date date,
    reviewed_at timestamp with time zone,
    form_id text,
    form_text text,
    role text,
    person_name text,
    person_norm text,
    is_ambiguous boolean DEFAULT false,
    score_value integer,
    issues text[],
    notes text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_units_flat_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_units_flat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_units_flat_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_units_flat_id_seq OWNED BY public.audit_units_flat.id;


--
-- Name: case_status_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_status_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: daycase_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daycase_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: department_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_aliases (
    alias text NOT NULL,
    canonical text NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    category text,
    pin_hash text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT departments_category_check CHECK ((category = ANY (ARRAY['surgery'::text, 'anesthesia'::text, 'internal_medicine'::text, 'pediatrics'::text, 'other'::text])))
);


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    specialty text DEFAULT ''::text,
    department text DEFAULT ''::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    role text,
    department_normalized text
);


--
-- Name: file_specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_specialties (
    medical_id text NOT NULL,
    visit_number text NOT NULL,
    specialty text
);


--
-- Name: form_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    text text NOT NULL,
    requires_date boolean DEFAULT false,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    app_id text DEFAULT 'medical-audit'::text
);


--
-- Name: form_daycase_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_daycase_map (
    form_id uuid NOT NULL,
    daycase_id uuid NOT NULL
);


--
-- Name: form_exclusion_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_exclusion_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid,
    exclusion_kind text NOT NULL,
    exclusion_id uuid NOT NULL,
    CONSTRAINT form_exclusion_map_exclusion_kind_check CHECK ((exclusion_kind = ANY (ARRAY['admission_type'::text, 'case_status'::text])))
);


--
-- Name: form_service_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_service_map (
    form_id uuid NOT NULL,
    service_id uuid NOT NULL
);


--
-- Name: form_specialty_map; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_specialty_map (
    form_id uuid NOT NULL,
    specialty_id uuid NOT NULL
);


--
-- Name: issue_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    category_id uuid,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    app_id text DEFAULT 'medical-audit'::text
);


--
-- Name: issue_category_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_category_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    app_id text DEFAULT 'medical-audit'::text
);


--
-- Name: medical_file_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_file_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    medical_id text NOT NULL,
    visit_number text NOT NULL,
    patient_name text NOT NULL,
    admission_date date,
    discharge_date date,
    case_status text,
    admission_type text,
    movement text,
    consultant text,
    specialties text,
    services text,
    ward_questions jsonb DEFAULT '[]'::jsonb,
    audit_questions jsonb DEFAULT '[]'::jsonb,
    is_partial boolean DEFAULT false,
    reviewer_id uuid,
    reviewer_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    app_id text DEFAULT 'medical-audit'::text,
    CONSTRAINT medical_file_reviews_case_status_check CHECK (((case_status = ANY (ARRAY['Open'::text, 'Closed'::text])) OR (case_status IS NULL)))
);


--
-- Name: medical_file_reviews_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_file_reviews_backup (
    id uuid,
    medical_id text,
    visit_number text,
    patient_name text,
    admission_date date,
    discharge_date date,
    case_status text,
    admission_type text,
    movement text,
    consultant text,
    specialties text,
    services text,
    ward_questions jsonb,
    audit_questions jsonb,
    is_partial boolean,
    reviewer_id uuid,
    reviewer_name text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    app_id text
);


--
-- Name: nurses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nurses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    department text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role text DEFAULT 'viewer'::text,
    is_active boolean DEFAULT true,
    display_name text,
    phone text,
    department text,
    CONSTRAINT check_valid_role CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'auditor'::text, 'senior'::text, 'doctor'::text, 'reviewer_doctor'::text, 'viewer'::text])))
);


--
-- Name: role_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role text NOT NULL,
    app_id text NOT NULL,
    allowed boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: score_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.score_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: specialty_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialty_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_fingerprint text NOT NULL,
    last_used_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    device_id text NOT NULL,
    device_info jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    grace_used boolean DEFAULT false NOT NULL,
    ended_at timestamp with time zone,
    ended_reason text,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: v_file_quality; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_file_quality AS
 WITH unit_scores AS (
         SELECT audit_units_flat.medical_id,
            audit_units_flat.visit_number,
            sum(audit_units_flat.score_value) AS total_score,
            (count(*) FILTER (WHERE (audit_units_flat.score_value IS NOT NULL)) * 2) AS max_score
           FROM public.audit_units_flat
          GROUP BY audit_units_flat.medical_id, audit_units_flat.visit_number
        ), unit_issues AS (
         SELECT sub.medical_id,
            sub.visit_number,
            array_agg(DISTINCT sub.issue) FILTER (WHERE ((sub.issue IS NOT NULL) AND (sub.issue <> ''::text))) AS issues
           FROM ( SELECT audit_units_flat.medical_id,
                    audit_units_flat.visit_number,
                    unnest(audit_units_flat.issues) AS issue
                   FROM public.audit_units_flat) sub
          GROUP BY sub.medical_id, sub.visit_number
        )
 SELECT m.id AS review_id,
    m.medical_id,
    m.visit_number,
    m.discharge_date,
    m.reviewed_at,
    m.reviewer_id,
    COALESCE(p.display_name, p.username, m.reviewer_name, 'غير معروف'::text) AS reviewer_name,
    p.department AS reviewer_department,
    p.role AS reviewer_role,
    fs.specialty,
    COALESCE(round((((us.total_score)::numeric / (NULLIF(us.max_score, 0))::numeric) * (100)::numeric)), (0)::numeric) AS quality_pct,
    COALESCE(ui.issues, ARRAY[]::text[]) AS issues
   FROM ((((public.medical_file_reviews m
     LEFT JOIN public.profiles p ON ((m.reviewer_id = p.id)))
     LEFT JOIN public.file_specialties fs ON (((m.medical_id = fs.medical_id) AND (m.visit_number = fs.visit_number))))
     LEFT JOIN unit_scores us ON (((m.medical_id = us.medical_id) AND (m.visit_number = us.visit_number))))
     LEFT JOIN unit_issues ui ON (((m.medical_id = ui.medical_id) AND (m.visit_number = ui.visit_number))));


--
-- Name: ward_clerks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ward_clerks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: work_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eval_month text NOT NULL,
    employee_name text NOT NULL,
    q1 integer DEFAULT 10,
    q2 integer DEFAULT 10,
    q3 integer DEFAULT 10,
    q4 integer DEFAULT 10,
    q5 integer DEFAULT 10,
    q6 integer DEFAULT 10,
    q7 integer DEFAULT 10,
    q8 integer DEFAULT 10,
    q9 integer DEFAULT 10,
    q10 integer DEFAULT 10,
    total_score integer GENERATED ALWAYS AS ((((((((((q1 + q2) + q3) + q4) + q5) + q6) + q7) + q8) + q9) + q10)) STORED,
    notes text,
    supervisor_name text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: work_file_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_file_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_record_id uuid,
    batch_id uuid,
    mrn text,
    patient_name text,
    models_count integer DEFAULT 0,
    work_path text,
    work_method text,
    employee_name text,
    daily_exit_date date,
    work_date date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: work_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    work_date date NOT NULL,
    daily_exit_date date,
    movement_type text NOT NULL,
    employee_name text NOT NULL,
    work_path text,
    work_method text,
    target_quota integer DEFAULT 0,
    actual_count integer DEFAULT 0,
    models_count integer DEFAULT 0,
    notes text,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: work_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    name text NOT NULL,
    emp_type text DEFAULT 'Other'::text NOT NULL,
    daily_target integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_units_flat id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_units_flat ALTER COLUMN id SET DEFAULT nextval('public.audit_units_flat_id_seq'::regclass);


--
-- Name: admission_type_catalog admission_type_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_type_catalog
    ADD CONSTRAINT admission_type_catalog_name_key UNIQUE (name);


--
-- Name: admission_type_catalog admission_type_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_type_catalog
    ADD CONSTRAINT admission_type_catalog_pkey PRIMARY KEY (id);


--
-- Name: app_catalog_map app_catalog_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_catalog_map
    ADD CONSTRAINT app_catalog_map_pkey PRIMARY KEY (app_id, catalog_key);


--
-- Name: apps apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apps
    ADD CONSTRAINT apps_pkey PRIMARY KEY (id);


--
-- Name: audit_error_logs audit_error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_error_logs
    ADD CONSTRAINT audit_error_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: audit_records audit_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_pkey PRIMARY KEY (id);


--
-- Name: audit_records audit_records_record_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_record_code_key UNIQUE (record_code);


--
-- Name: audit_units_flat audit_units_flat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_units_flat
    ADD CONSTRAINT audit_units_flat_pkey PRIMARY KEY (id);


--
-- Name: case_status_catalog case_status_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_catalog
    ADD CONSTRAINT case_status_catalog_name_key UNIQUE (name);


--
-- Name: case_status_catalog case_status_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_catalog
    ADD CONSTRAINT case_status_catalog_pkey PRIMARY KEY (id);


--
-- Name: daycase_catalog daycase_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daycase_catalog
    ADD CONSTRAINT daycase_catalog_name_key UNIQUE (name);


--
-- Name: daycase_catalog daycase_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daycase_catalog
    ADD CONSTRAINT daycase_catalog_pkey PRIMARY KEY (id);


--
-- Name: department_aliases department_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_aliases
    ADD CONSTRAINT department_aliases_pkey PRIMARY KEY (alias);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_name_key UNIQUE (name);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: file_specialties file_specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_specialties
    ADD CONSTRAINT file_specialties_pkey PRIMARY KEY (medical_id, visit_number);


--
-- Name: form_catalog form_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_catalog
    ADD CONSTRAINT form_catalog_pkey PRIMARY KEY (id);


--
-- Name: form_catalog form_catalog_text_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_catalog
    ADD CONSTRAINT form_catalog_text_key UNIQUE (text);


--
-- Name: form_daycase_map form_daycase_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_daycase_map
    ADD CONSTRAINT form_daycase_map_pkey PRIMARY KEY (form_id, daycase_id);


--
-- Name: form_exclusion_map form_exclusion_map_form_id_exclusion_kind_exclusion_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_exclusion_map
    ADD CONSTRAINT form_exclusion_map_form_id_exclusion_kind_exclusion_id_key UNIQUE (form_id, exclusion_kind, exclusion_id);


--
-- Name: form_exclusion_map form_exclusion_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_exclusion_map
    ADD CONSTRAINT form_exclusion_map_pkey PRIMARY KEY (id);


--
-- Name: form_service_map form_service_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_service_map
    ADD CONSTRAINT form_service_map_pkey PRIMARY KEY (form_id, service_id);


--
-- Name: form_specialty_map form_specialty_map_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_specialty_map
    ADD CONSTRAINT form_specialty_map_pkey PRIMARY KEY (form_id, specialty_id);


--
-- Name: issue_catalog issue_catalog_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_catalog
    ADD CONSTRAINT issue_catalog_code_key UNIQUE (code);


--
-- Name: issue_catalog issue_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_catalog
    ADD CONSTRAINT issue_catalog_pkey PRIMARY KEY (id);


--
-- Name: issue_category_catalog issue_category_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_category_catalog
    ADD CONSTRAINT issue_category_catalog_name_key UNIQUE (name);


--
-- Name: issue_category_catalog issue_category_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_category_catalog
    ADD CONSTRAINT issue_category_catalog_pkey PRIMARY KEY (id);


--
-- Name: medical_file_reviews medical_file_reviews_medical_id_visit_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_file_reviews
    ADD CONSTRAINT medical_file_reviews_medical_id_visit_number_key UNIQUE (medical_id, visit_number);


--
-- Name: medical_file_reviews medical_file_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_file_reviews
    ADD CONSTRAINT medical_file_reviews_pkey PRIMARY KEY (id);


--
-- Name: nurses nurses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurses
    ADD CONSTRAINT nurses_name_key UNIQUE (name);


--
-- Name: nurses nurses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurses
    ADD CONSTRAINT nurses_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: role_catalog role_catalog_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_catalog
    ADD CONSTRAINT role_catalog_code_key UNIQUE (code);


--
-- Name: role_catalog role_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_catalog
    ADD CONSTRAINT role_catalog_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role, app_id);


--
-- Name: score_catalog score_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score_catalog
    ADD CONSTRAINT score_catalog_pkey PRIMARY KEY (id);


--
-- Name: score_catalog score_catalog_value_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.score_catalog
    ADD CONSTRAINT score_catalog_value_key UNIQUE (value);


--
-- Name: service_catalog service_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_catalog
    ADD CONSTRAINT service_catalog_name_key UNIQUE (name);


--
-- Name: service_catalog service_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_catalog
    ADD CONSTRAINT service_catalog_pkey PRIMARY KEY (id);


--
-- Name: specialty_catalog specialty_catalog_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_catalog
    ADD CONSTRAINT specialty_catalog_name_key UNIQUE (name);


--
-- Name: specialty_catalog specialty_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialty_catalog
    ADD CONSTRAINT specialty_catalog_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_user_id_device_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_device_fingerprint_key UNIQUE (user_id, device_fingerprint);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: ward_clerks ward_clerks_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_clerks
    ADD CONSTRAINT ward_clerks_name_key UNIQUE (name);


--
-- Name: ward_clerks ward_clerks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ward_clerks
    ADD CONSTRAINT ward_clerks_pkey PRIMARY KEY (id);


--
-- Name: work_evaluations work_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_evaluations
    ADD CONSTRAINT work_evaluations_pkey PRIMARY KEY (id);


--
-- Name: work_file_tracking work_file_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_file_tracking
    ADD CONSTRAINT work_file_tracking_pkey PRIMARY KEY (id);


--
-- Name: work_records work_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_records
    ADD CONSTRAINT work_records_pkey PRIMARY KEY (id);


--
-- Name: work_staff work_staff_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_staff
    ADD CONSTRAINT work_staff_name_key UNIQUE (name);


--
-- Name: work_staff work_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_staff
    ADD CONSTRAINT work_staff_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_severity ON public.audit_log USING btree (severity);


--
-- Name: idx_audit_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_id);


--
-- Name: idx_auf_discharge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auf_discharge ON public.audit_units_flat USING btree (discharge_date);


--
-- Name: idx_auf_form; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auf_form ON public.audit_units_flat USING btree (form_text);


--
-- Name: idx_auf_reviewed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auf_reviewed ON public.audit_units_flat USING btree (reviewed_at);


--
-- Name: idx_auf_role_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auf_role_person ON public.audit_units_flat USING btree (role, person_norm);


--
-- Name: idx_auf_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auf_score ON public.audit_units_flat USING btree (score_value);


--
-- Name: idx_clerks_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clerks_active ON public.ward_clerks USING btree (is_active);


--
-- Name: idx_doctors_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_active ON public.doctors USING btree (is_active);


--
-- Name: idx_doctors_name_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_name_norm ON public.doctors USING btree (public.normalize_arabic(name));


--
-- Name: idx_evals_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evals_emp ON public.work_evaluations USING btree (employee_name);


--
-- Name: idx_form_catalog_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_catalog_active ON public.form_catalog USING btree (is_active);


--
-- Name: idx_form_catalog_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_catalog_app_id ON public.form_catalog USING btree (app_id);


--
-- Name: idx_form_serv_form; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_serv_form ON public.form_service_map USING btree (form_id);


--
-- Name: idx_form_spec_form; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_spec_form ON public.form_specialty_map USING btree (form_id);


--
-- Name: idx_form_spec_spec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_spec_spec ON public.form_specialty_map USING btree (specialty_id);


--
-- Name: idx_issue_catalog_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issue_catalog_app_id ON public.issue_catalog USING btree (app_id);


--
-- Name: idx_issue_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issue_category ON public.issue_catalog USING btree (category_id);


--
-- Name: idx_issue_category_catalog_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issue_category_catalog_app_id ON public.issue_category_catalog USING btree (app_id);


--
-- Name: idx_mfr_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfr_app_id ON public.medical_file_reviews USING btree (app_id);


--
-- Name: idx_mfr_discharge_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfr_discharge_reviewer ON public.medical_file_reviews USING btree (discharge_date, public.clean_reviewer_name(reviewer_name)) WHERE (discharge_date IS NOT NULL);


--
-- Name: idx_mfr_reviewed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfr_reviewed_at ON public.medical_file_reviews USING btree (reviewed_at);


--
-- Name: idx_mfr_reviewer_clean; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfr_reviewer_clean ON public.medical_file_reviews USING btree (public.clean_reviewer_name(reviewer_name)) WHERE (public.clean_reviewer_name(reviewer_name) <> ''::text);


--
-- Name: idx_nurses_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nurses_active ON public.nurses USING btree (is_active);


--
-- Name: idx_nurses_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nurses_name ON public.nurses USING btree (name);


--
-- Name: idx_nurses_name_norm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nurses_name_norm ON public.nurses USING btree (public.normalize_arabic(name));


--
-- Name: idx_reviews_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created ON public.medical_file_reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_medid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_medid ON public.medical_file_reviews USING btree (medical_id);


--
-- Name: idx_reviews_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_partial ON public.medical_file_reviews USING btree (is_partial);


--
-- Name: idx_reviews_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_reviewer ON public.medical_file_reviews USING btree (reviewer_id);


--
-- Name: idx_reviews_visit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_visit ON public.medical_file_reviews USING btree (visit_number);


--
-- Name: idx_tracking_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracking_batch ON public.work_file_tracking USING btree (batch_id);


--
-- Name: idx_tracking_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tracking_emp ON public.work_file_tracking USING btree (employee_name);


--
-- Name: idx_trusted_devices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trusted_devices_user ON public.trusted_devices USING btree (user_id);


--
-- Name: idx_user_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at) WHERE (is_active = true);


--
-- Name: idx_user_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_token ON public.user_sessions USING btree (session_token);


--
-- Name: idx_user_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_active ON public.user_sessions USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_work_records_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_records_batch ON public.work_records USING btree (batch_id);


--
-- Name: idx_work_records_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_records_date ON public.work_records USING btree (work_date);


--
-- Name: idx_work_records_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_records_emp ON public.work_records USING btree (employee_name);


--
-- Name: form_catalog trg_form_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_form_updated_at BEFORE UPDATE ON public.form_catalog FOR EACH ROW EXECUTE FUNCTION public.update_form_updated_at();


--
-- Name: medical_file_reviews trg_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.medical_file_reviews FOR EACH ROW EXECUTE FUNCTION public.update_review_updated_at();


--
-- Name: form_catalog trg_shift_form_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shift_form_order BEFORE INSERT OR UPDATE OF order_index ON public.form_catalog FOR EACH ROW EXECUTE FUNCTION public.shift_form_order();


--
-- Name: medical_file_reviews trg_sync_audit_units; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_audit_units AFTER INSERT OR DELETE OR UPDATE ON public.medical_file_reviews FOR EACH ROW EXECUTE FUNCTION public.sync_audit_units();


--
-- Name: doctors trg_sync_doctor_dept; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_doctor_dept BEFORE INSERT OR UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.sync_doctor_dept();


--
-- Name: app_catalog_map app_catalog_map_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_catalog_map
    ADD CONSTRAINT app_catalog_map_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id) ON DELETE CASCADE;


--
-- Name: audit_error_logs audit_error_logs_audit_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_error_logs
    ADD CONSTRAINT audit_error_logs_audit_record_id_fkey FOREIGN KEY (audit_record_id) REFERENCES public.audit_records(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_records audit_records_audited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_audited_by_fkey FOREIGN KEY (audited_by) REFERENCES auth.users(id);


--
-- Name: audit_records audit_records_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: role_permissions fk_role_permissions_app; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_app FOREIGN KEY (app_id) REFERENCES public.apps(id);


--
-- Name: form_catalog form_catalog_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_catalog
    ADD CONSTRAINT form_catalog_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id);


--
-- Name: form_daycase_map form_daycase_map_daycase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_daycase_map
    ADD CONSTRAINT form_daycase_map_daycase_id_fkey FOREIGN KEY (daycase_id) REFERENCES public.daycase_catalog(id) ON DELETE CASCADE;


--
-- Name: form_daycase_map form_daycase_map_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_daycase_map
    ADD CONSTRAINT form_daycase_map_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.form_catalog(id) ON DELETE CASCADE;


--
-- Name: form_exclusion_map form_exclusion_map_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_exclusion_map
    ADD CONSTRAINT form_exclusion_map_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.form_catalog(id) ON DELETE CASCADE;


--
-- Name: form_service_map form_service_map_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_service_map
    ADD CONSTRAINT form_service_map_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.form_catalog(id) ON DELETE CASCADE;


--
-- Name: form_service_map form_service_map_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_service_map
    ADD CONSTRAINT form_service_map_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.service_catalog(id) ON DELETE CASCADE;


--
-- Name: form_specialty_map form_specialty_map_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_specialty_map
    ADD CONSTRAINT form_specialty_map_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.form_catalog(id) ON DELETE CASCADE;


--
-- Name: form_specialty_map form_specialty_map_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_specialty_map
    ADD CONSTRAINT form_specialty_map_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.specialty_catalog(id) ON DELETE CASCADE;


--
-- Name: issue_catalog issue_catalog_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_catalog
    ADD CONSTRAINT issue_catalog_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id);


--
-- Name: issue_catalog issue_catalog_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_catalog
    ADD CONSTRAINT issue_catalog_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.issue_category_catalog(id) ON DELETE SET NULL;


--
-- Name: issue_category_catalog issue_category_catalog_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_category_catalog
    ADD CONSTRAINT issue_category_catalog_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id);


--
-- Name: medical_file_reviews medical_file_reviews_app_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_file_reviews
    ADD CONSTRAINT medical_file_reviews_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.apps(id);


--
-- Name: medical_file_reviews medical_file_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_file_reviews
    ADD CONSTRAINT medical_file_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: trusted_devices trusted_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: work_evaluations work_evaluations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_evaluations
    ADD CONSTRAINT work_evaluations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: work_file_tracking work_file_tracking_work_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_file_tracking
    ADD CONSTRAINT work_file_tracking_work_record_id_fkey FOREIGN KEY (work_record_id) REFERENCES public.work_records(id) ON DELETE CASCADE;


--
-- Name: work_records work_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_records
    ADD CONSTRAINT work_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: work_staff work_staff_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_staff
    ADD CONSTRAINT work_staff_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: audit_log Admins can read audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read audit log" ON public.audit_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text]))))));


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: audit_units_flat Allow authenticated full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated full access" ON public.audit_units_flat TO authenticated USING (true) WITH CHECK (true);


--
-- Name: audit_error_logs Allow full access for authenticated users on audit_error_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow full access for authenticated users on audit_error_logs" ON public.audit_error_logs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: audit_records Allow full access for authenticated users on audit_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow full access for authenticated users on audit_records" ON public.audit_records TO authenticated USING (true) WITH CHECK (true);


--
-- Name: departments Allow read access for authenticated users on departments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access for authenticated users on departments" ON public.departments FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: role_permissions Anyone can read role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions Only super_admin can modify role_permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only super_admin can modify role_permissions" ON public.role_permissions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text)))));


--
-- Name: profiles Public profiles are viewable by everyone.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);


--
-- Name: trusted_devices Users can delete own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own devices" ON public.trusted_devices FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: trusted_devices Users can register own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can register own devices" ON public.trusted_devices FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: trusted_devices Users can see their own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own devices" ON public.trusted_devices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: trusted_devices Users can update own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own devices" ON public.trusted_devices FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: trusted_devices Users can view own devices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own devices" ON public.trusted_devices FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: admission_type_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admission_type_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: admission_type_catalog admission_type_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admission_type_catalog_admin ON public.admission_type_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: admission_type_catalog admission_type_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admission_type_catalog_read ON public.admission_type_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: app_catalog_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_catalog_map ENABLE ROW LEVEL SECURITY;

--
-- Name: apps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

--
-- Name: apps apps_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY apps_admin_write ON public.apps USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text]))))));


--
-- Name: apps apps_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY apps_read_all ON public.apps FOR SELECT USING (true);


--
-- Name: audit_error_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_error_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_delete_by_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_delete_by_admin ON public.audit_log FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND ((profiles.role = 'super_admin'::text) OR ((profiles.role = ANY (ARRAY['admin'::text, 'reviewer_doctor'::text])) AND (audit_log.severity = ANY (ARRAY['info'::text, 'warning'::text]))))))));


--
-- Name: audit_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_records ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_units_flat; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_units_flat ENABLE ROW LEVEL SECURITY;

--
-- Name: work_evaluations auth_all_evals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_all_evals ON public.work_evaluations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: work_records auth_all_records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_all_records ON public.work_records TO authenticated USING (true) WITH CHECK (true);


--
-- Name: work_staff auth_all_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_all_staff ON public.work_staff TO authenticated USING (true) WITH CHECK (true);


--
-- Name: work_file_tracking auth_all_tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_all_tracking ON public.work_file_tracking TO authenticated USING (true) WITH CHECK (true);


--
-- Name: user_sessions auth_all_user_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_all_user_sessions ON public.user_sessions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: medical_file_reviews authenticated_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all_access ON public.medical_file_reviews TO authenticated USING (true) WITH CHECK (true);


--
-- Name: medical_file_reviews authenticated_select_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_reviews ON public.medical_file_reviews FOR SELECT TO authenticated USING (true);


--
-- Name: medical_file_reviews authenticated_update_reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_update_reviews ON public.medical_file_reviews FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'auditor'::text, 'senior'::text, 'doctor'::text, 'reviewer_doctor'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_active = true) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'auditor'::text, 'senior'::text, 'doctor'::text, 'reviewer_doctor'::text]))))));


--
-- Name: case_status_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.case_status_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: case_status_catalog case_status_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY case_status_catalog_admin ON public.case_status_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: case_status_catalog case_status_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY case_status_catalog_read ON public.case_status_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: ward_clerks clerks_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clerks_manage ON public.ward_clerks TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text]))))));


--
-- Name: ward_clerks clerks_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clerks_read ON public.ward_clerks FOR SELECT TO authenticated USING (true);


--
-- Name: daycase_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daycase_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: daycase_catalog daycase_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daycase_catalog_admin ON public.daycase_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: daycase_catalog daycase_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daycase_catalog_read ON public.daycase_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: department_aliases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.department_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: doctors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

--
-- Name: doctors doctors_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doctors_admin ON public.doctors TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: doctors doctors_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doctors_manage ON public.doctors TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text]))))));


--
-- Name: doctors doctors_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doctors_read ON public.doctors FOR SELECT TO authenticated USING (true);


--
-- Name: file_specialties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.file_specialties ENABLE ROW LEVEL SECURITY;

--
-- Name: form_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: form_catalog form_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_catalog_admin ON public.form_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: form_catalog form_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_catalog_read ON public.form_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: form_daycase_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_daycase_map ENABLE ROW LEVEL SECURITY;

--
-- Name: form_daycase_map form_daycase_map_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_daycase_map_admin ON public.form_daycase_map TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: form_daycase_map form_daycase_map_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_daycase_map_read ON public.form_daycase_map FOR SELECT TO authenticated USING (true);


--
-- Name: form_exclusion_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_exclusion_map ENABLE ROW LEVEL SECURITY;

--
-- Name: form_exclusion_map form_exclusion_map_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_exclusion_map_admin ON public.form_exclusion_map TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: form_exclusion_map form_exclusion_map_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_exclusion_map_read ON public.form_exclusion_map FOR SELECT TO authenticated USING (true);


--
-- Name: form_service_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_service_map ENABLE ROW LEVEL SECURITY;

--
-- Name: form_service_map form_service_map_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_service_map_admin ON public.form_service_map TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: form_service_map form_service_map_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_service_map_read ON public.form_service_map FOR SELECT TO authenticated USING (true);


--
-- Name: form_specialty_map; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_specialty_map ENABLE ROW LEVEL SECURITY;

--
-- Name: form_specialty_map form_specialty_map_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_specialty_map_admin ON public.form_specialty_map TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: form_specialty_map form_specialty_map_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_specialty_map_read ON public.form_specialty_map FOR SELECT TO authenticated USING (true);


--
-- Name: issue_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.issue_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: issue_catalog issue_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_catalog_admin ON public.issue_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: issue_catalog issue_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_catalog_read ON public.issue_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: issue_category_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.issue_category_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: issue_category_catalog issue_category_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_category_catalog_admin ON public.issue_category_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: issue_category_catalog issue_category_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_category_catalog_read ON public.issue_category_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: medical_file_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medical_file_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: medical_file_reviews_backup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medical_file_reviews_backup ENABLE ROW LEVEL SECURITY;

--
-- Name: nurses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nurses ENABLE ROW LEVEL SECURITY;

--
-- Name: nurses nurses_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nurses_delete_admin ON public.nurses FOR DELETE TO authenticated USING (public.is_catalog_admin());


--
-- Name: nurses nurses_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nurses_insert_authenticated ON public.nurses FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: nurses nurses_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nurses_select_authenticated ON public.nurses FOR SELECT TO authenticated USING (true);


--
-- Name: nurses nurses_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nurses_update_admin ON public.nurses FOR UPDATE TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: medical_file_reviews reviews_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_delete ON public.medical_file_reviews FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text]))))));


--
-- Name: medical_file_reviews reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_insert ON public.medical_file_reviews FOR INSERT TO authenticated WITH CHECK (((reviewer_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'auditor'::text, 'senior'::text, 'doctor'::text, 'reviewer_doctor'::text])))))));


--
-- Name: medical_file_reviews reviews_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_update ON public.medical_file_reviews FOR UPDATE TO authenticated USING (((reviewer_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'reviewer_doctor'::text])))))));


--
-- Name: role_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: role_catalog role_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_catalog_admin ON public.role_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: role_catalog role_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_catalog_read ON public.role_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: score_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.score_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: score_catalog score_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY score_catalog_admin ON public.score_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: score_catalog score_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY score_catalog_read ON public.score_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: service_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: service_catalog service_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_catalog_admin ON public.service_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: service_catalog service_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_catalog_read ON public.service_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: specialty_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.specialty_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: specialty_catalog specialty_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY specialty_catalog_admin ON public.specialty_catalog TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: specialty_catalog specialty_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY specialty_catalog_read ON public.specialty_catalog FOR SELECT TO authenticated USING (true);


--
-- Name: form_catalog temp_read_forms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_read_forms ON public.form_catalog FOR SELECT TO anon USING (true);


--
-- Name: issue_category_catalog temp_read_issue_cats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_read_issue_cats ON public.issue_category_catalog FOR SELECT TO anon USING (true);


--
-- Name: issue_catalog temp_read_issues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_read_issues ON public.issue_catalog FOR SELECT TO anon USING (true);


--
-- Name: score_catalog temp_read_scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY temp_read_scores ON public.score_catalog FOR SELECT TO anon USING (true);


--
-- Name: trusted_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ward_clerks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ward_clerks ENABLE ROW LEVEL SECURITY;

--
-- Name: ward_clerks ward_clerks_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ward_clerks_admin ON public.ward_clerks TO authenticated USING (public.is_catalog_admin()) WITH CHECK (public.is_catalog_admin());


--
-- Name: ward_clerks ward_clerks_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ward_clerks_read ON public.ward_clerks FOR SELECT TO authenticated USING (true);


--
-- Name: work_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: work_file_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_file_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: work_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_records ENABLE ROW LEVEL SECURITY;

--
-- Name: work_staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_staff ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict i8gpBPaGg208sqox1vTjxBqlOUQMrV6SxAfYhZlAhYMmIhxe6gvEgS5oqMwDtGl

