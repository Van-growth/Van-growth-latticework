#!/usr/bin/env node
/**
 * PostToolUse hook: detects new Supabase migration files written by Claude
 * and prompts automatic application via Supabase MCP.
 *
 * Stdin: JSON from Claude Code hook system { tool_name, tool_input, tool_response }
 * Stdout: message visible to Claude → triggers immediate MCP apply_migration call
 */
import { readFileSync } from 'fs';
import { basename } from 'path';

const PROJECT_ID = 'rtpcmbxijcxhzvortwxf';

let raw = '';
try {
  raw = readFileSync(0).toString('utf-8').replace(/^﻿/, '');
} catch {
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  process.exit(0);
}

const { tool_name, tool_input } = parsed;
if (tool_name !== 'Write') process.exit(0);

const filePath = (tool_input?.file_path ?? '').replace(/\\/g, '/');
if (!/supabase\/migrations\/[^/]+\.sql$/.test(filePath)) process.exit(0);

const migrationName = basename(filePath).replace(/\.sql$/, '');
const sql = (tool_input?.content ?? '').trim();

console.log(`\n[migration-hook] 새 마이그레이션 파일 감지: ${basename(filePath)}`);
console.log(`Supabase MCP apply_migration을 즉시 호출하세요:`);
console.log(`  project_id : ${PROJECT_ID}`);
console.log(`  name       : ${migrationName}`);
console.log(`  query      :\n${sql}`);
