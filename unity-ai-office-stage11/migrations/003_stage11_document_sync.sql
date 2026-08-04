-- Synchronize the 2026-08-04 integrated-build directive into all required AI Office Markdown sources.
begin;

do $$
declare r record; v_append text; v_content text; v_new_id uuid; v_context_key text;
begin
  for r in
    select s.source_key,s.display_name,v.id old_id,v.content_text
    from public.ai_office_document_sources s
    join lateral (
      select * from public.ai_office_document_versions v
      where v.source_key=s.source_key and v.status='ACTIVE'
      order by v.ingested_at desc limit 1
    ) v on true
    where s.is_active and s.is_required
    order by s.authority_rank
  loop
    v_append:=case r.source_key
      when 'master_md' then E'\n\n---\n\n## 2026-08-04 AI Office 통합 개발 실행 원칙\n\n- 승인된 전체 범위를 한 번에 구현하고, 통합 테스트·보안 검수·배포 검증·버그 수정까지 완료한 뒤 최종 결과만 보고한다.\n- 기능별 중간 보고로 전체 개발을 인위적으로 분절하지 않는다.\n- API Key, 비용한도, 법적 승인값은 추측하거나 임의 생성하지 않는다.\n- Game V5 디자인은 동결하며 Backend, PMO, Agent, Audit, 문서, 비용, 보안 기능만 연결한다.\n'
      when 'session_md' then E'\n\n---\n\n## 2026-08-04 현재 세션 확정\n\n- 전체 범위 통합 구현 → 전체 QA → 버그 수정 → 재검증 → 최종 결과 보고.\n- AI Office Runtime은 Stage 11 Hardened다.\n- 실제 유료 실행은 Vault API Key와 승인 THB 비용한도 입력 전까지 차단한다.\n'
      when 'decision_log_md' then E'\n\n---\n\n## 2026-08-04 결정 — 통합 완성 우선 개발\n\n- 기능별 중간 보고 대신 승인 범위를 통째로 구현하고 전체 QA와 버그 수정을 끝낸 뒤 결과를 보고한다.\n- 디자인 동결, 추측 금지, 외부 입력 임의 생성 금지와 충돌하지 않는다.\n'
      when 'sop_md' then E'\n\n---\n\n## AI Office 통합 개발 SOP — 2026-08-04\n\n1. 승인 범위 고정.\n2. 전체 구현.\n3. DB·API·Runner·Agent·PMO·Audit·보안·로그 통합 검증.\n4. 버그 수정 후 전체 테스트 재실행.\n5. 임시 데이터 정리.\n6. 실제 URL과 Backend 응답 검증.\n7. 최종 결과와 외부 입력 잔여 게이트만 보고.\n'
      when 'tech_md' then E'\n\n---\n\n## Stage 11 Hardened Runtime — 2026-08-04\n\n- 의존 실패 전파, Job 전환 감사, Lease 복구, 승인 재개, Rate Limit, Command Idempotency, 문서 무결성, 품질검수, 사용량·비용 기록을 통합했다.\n- Public Data API 직접 접근을 차단한다.\n- Game V5 디자인 파일은 변경하지 않는다.\n'
      when 'ai_audit_md' then E'\n\n---\n\n## 2026-08-04 재발방지 감사 규칙\n\n- 기능별 중간 보고로 전체 범위를 분절하지 않는다.\n- 통합 QA 실패 상태에서 완료를 주장하지 않는다.\n- 실패 의존성을 가진 후속 Job을 영구 대기시키지 않는다.\n- 중복 Command가 중복 Job을 만들지 않도록 검증한다.\n- Key·비용한도·승인값을 추측하지 않는다.\n'
      when 'todo_md' then E'\n\n---\n\n## 2026-08-04 AI Office 상태\n\n### 완료\n- Stage 11 통합 Backend, 의존 실패 차단, Job 감사, Rate Limit, Idempotency, RLS 강화, Workflow Self-Test.\n\n### 외부 입력 필요\n- OpenAI API Key, 승인된 일일·월간 THB 비용한도, 실제 유료 E2E와 GPT(PMO) 최종 승인.\n'
      when 'project_dashboard_md' then E'\n\n---\n\n## AI Office 개발 현황 — 2026-08-04\n\n| 항목 | 상태 |\n|---|---|\n| Game V5 디자인 | 동결 |\n| Runtime | Stage 11 Hardened |\n| 문서 무결성 | PASS |\n| 통합 Self-Test | PASS |\n| OpenAI Credential | 외부 입력 대기 |\n| THB Budget | Managing Director 확정 대기 |\n'
      when 'prompt_library_md' then E'\n\n---\n\n## 12. AI Office 통합 개발 실행\n\n```text\n승인된 전체 범위를 한 번에 구현하고 통합 QA, 버그수정, 재검증 후 최종 결과만 보고해라.\nGame V5 디자인은 변경하지 마라.\nAPI Key, 비용한도, 법적 승인값은 추측하지 마라.\n```\n'
      else ''
    end;
    v_content:=r.content_text||v_append;
    update public.ai_office_document_versions set status='SUPERSEDED' where id=r.old_id;
    insert into public.ai_office_document_versions(source_key,version_label,content_hash,content_text,source_updated_at,ingested_at,status,supersedes_id,metadata)
    values(r.source_key,'2026-08-04-stage11-integrated-build',encode(extensions.digest(v_content,'sha256'),'hex'),v_content,now(),now(),'ACTIVE',r.old_id,jsonb_build_object('stage','ONLINE_MULTI_AGENT_STAGE_11_HARDENED','decision','INTEGRATED_BUILD_END_ONLY_REPORTING')) returning id into v_new_id;
    v_context_key:=case r.source_key when 'master_md' then 'source_of_truth' when 'session_md' then 'current_session' when 'decision_log_md' then 'decision_log' when 'sop_md' then 'sop_rules' when 'tech_md' then 'technical_architecture' when 'ai_audit_md' then 'ai_audit_rules' when 'todo_md' then 'current_session' when 'project_dashboard_md' then 'current_session' when 'prompt_library_md' then 'ai_governance' end;
    perform public.ai_office_chunk_document_version(v_new_id,v_context_key,r.display_name,1600,200);
  end loop;
end $$;

update public.ai_office_context set content=content||jsonb_build_object('development_execution_mode','INTEGRATED_FULL_SCOPE_BUILD_THEN_FINAL_REPORT','intermediate_feature_reporting',false,'bug_fix_mode','FIX_WITHIN_FULL_QA_AND_RERUN_ALL_TESTS','external_input_rule','Never invent credentials, budget limits or legal approvals.'),version='2026-08-04-stage11',updated_at=now() where context_key in('source_of_truth','ai_governance','ai_office_direction','operating_principles');
update public.ai_office_context set content=content||jsonb_build_object('stage','ONLINE_MULTI_AGENT_STAGE_11_HARDENED','runtime','Dependency propagation, job transition audit, API rate limit and idempotency enabled.','frontend','Game V5 frozen and unchanged.'),version='2026-08-04-stage11',updated_at=now() where context_key in('current_runtime_stage','technical_architecture');
update public.ai_office_context set content=content||jsonb_build_object('effective_date','2026-08-04','latest_priority','Complete the entire approved AI Office functional scope, run integrated QA, fix bugs, rerun all tests, then report once.','remaining_external_gates',jsonb_build_array('OpenAI API key in Supabase Vault','Managing Director-approved daily and monthly THB limits','Real paid model E2E and GPT(PMO) approval')),version='2026-08-04-stage11',updated_at=now() where context_key='current_session';
update public.ai_office_context set content=content||jsonb_build_object('latest_decision',jsonb_build_object('date','2026-08-04','decision','Integrated full-scope implementation and end-only reporting.','reason','Reduce delay caused by fragmented implementation and repeated intermediate reporting.','impact','AI Office backend, PMO, agents, audit, documents, cost, security and deployment QA.','conflict','No conflict with design freeze, no-speculation or external-input controls.')),version='2026-08-04-stage11',updated_at=now() where context_key='decision_log';
update public.ai_office_context set content=content||jsonb_build_object('stage11_rules',jsonb_build_array('Do not claim completion before integrated QA passes.','Do not leave dependent jobs queued after a dependency fails.','Do not create duplicate jobs from duplicate commands.','Do not expose AI Office tables directly through anon or authenticated Data API roles.','Do not invent API keys, budget limits or approvals.')),version='2026-08-04-stage11',updated_at=now() where context_key='ai_audit_rules';

commit;
