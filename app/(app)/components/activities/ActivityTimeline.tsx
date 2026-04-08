'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { activityUI as UI, activityFW as FW } from './activityTokens';

type EntityType = 'company' | 'deal' | 'contract' | 'contact';
type ActivityType = 'note' | 'task' | 'call' | 'email' | 'meeting';

type ActivityRow = {
  id: number;
  created_at: string;

  entity_type: EntityType;
  entity_id: string;

  activity_type: ActivityType;
  title: string | null;
  body: string | null;

  due_date: string | null; // date as YYYY-MM-DD
  is_done: boolean;

  owner: string | null;
  created_by: string | null;

  meta: any | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function emojiForType(t: ActivityType) {
  if (t === 'note') return '📝';
  if (t === 'task') return '✅';
  if (t === 'call') return '📞';
  if (t === 'email') return '✉️';
  if (t === 'meeting') return '🗓️';
  return '•';
}

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  border: `1px solid ${UI.border}`,
  background: UI.soft,
  fontSize: 12,
  color: UI.secondary,
  whiteSpace: 'nowrap',
};

export default function ActivityTimeline(props: {
  entityType: EntityType;
  entityId: string;
  defaultOwner?: string | null;
}) {
  const { entityType, entityId, defaultOwner = null } = props;

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [activityType, setActivityType] = useState<ActivityType>('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueDate, setDueDate] = useState<string>(''); // YYYY-MM-DD
  const [owner, setOwner] = useState<string>(defaultOwner ?? '');
  const [createdBy, setCreatedBy] = useState<string>('');

  const stats = useMemo(() => {
    const total = rows.length;
    const openTasks = rows.filter(
      (r) => r.activity_type === 'task' && !r.is_done
    ).length;
    const overdueTasks = rows.filter(
      (r) =>
        r.activity_type === 'task' &&
        !r.is_done &&
        r.due_date &&
        new Date(r.due_date) < new Date(new Date().toISOString().slice(0, 10))
    ).length;
    const lastTouched = rows[0]?.created_at ?? null;
    return { total, openTasks, overdueTasks, lastTouched };
  }, [rows]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (!error) setRows((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!entityType || !entityId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function addActivity() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    // Basic validation
    if (activityType === 'note' && !trimmedBody && !trimmedTitle) {
      alert('Please add a title or body for the note.');
      return;
    }
    if (activityType === 'task' && !trimmedTitle) {
      alert('Task title is required.');
      return;
    }

    setSaving(true);
    const payload = {
      entity_type: entityType,
      entity_id: entityId,
      activity_type: activityType,
      title: trimmedTitle || null,
      body: trimmedBody || null,
      due_date: dueDate || null,
      owner: owner.trim() || null,
      created_by: createdBy.trim() || null,
    };

    const { error } = await supabase.from('activities').insert(payload as any);
    setSaving(false);

    if (error) {
      console.error(error);
      alert('Could not save activity. Check console for details.');
      return;
    }

    // reset form
    setTitle('');
    setBody('');
    setDueDate('');
    // keep owner / createdBy as convenience

    await load();
  }

  async function toggleDone(id: number, next: boolean) {
    const { error } = await supabase
      .from('activities')
      .update({ is_done: next })
      .eq('id', id);
    if (error) {
      console.error(error);
      alert('Could not update.');
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_done: next } : r))
    );
  }

  async function remove(id: number) {
    if (!confirm('Delete this activity?')) return;
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert('Could not delete.');
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div
      style={{
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        background: UI.bg,
        padding: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: FW.title, color: UI.text }}>
            Activity
          </div>
          <div style={{ fontSize: 12, color: UI.muted }}>
            {stats.lastTouched ? (
              <>
                Last touched:{' '}
                <span style={{ color: UI.secondary }}>
                  {fmtDate(stats.lastTouched)}
                </span>
              </>
            ) : (
              'No activity yet.'
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <span style={pillStyle}>
            Total: <b style={{ color: UI.text }}>{stats.total}</b>
          </span>
          <span style={pillStyle}>
            Open tasks: <b style={{ color: UI.text }}>{stats.openTasks}</b>
          </span>
          <span
            style={{
              ...pillStyle,
              borderColor: stats.overdueTasks ? UI.danger : UI.border,
              color: stats.overdueTasks ? UI.danger : UI.secondary,
            }}
          >
            Overdue:{' '}
            <b style={{ color: stats.overdueTasks ? UI.danger : UI.text }}>
              {stats.overdueTasks}
            </b>
          </span>
        </div>
      </div>

      {/* Composer */}
      <div
        style={{
          border: `1px solid ${UI.border}`,
          borderRadius: 12,
          background: UI.soft,
          padding: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 160px 1fr',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <label style={{ fontSize: 12, color: UI.secondary }}>Type</label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as ActivityType)}
            style={{
              padding: 8,
              borderRadius: 10,
              border: `1px solid ${UI.border}`,
              background: UI.bg,
            }}
          >
            <option value="note">Note</option>
            <option value="task">Task</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
          </select>

          <label style={{ fontSize: 12, color: UI.secondary }}>
            Due date (tasks)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={activityType !== 'task'}
            style={{
              padding: 8,
              borderRadius: 10,
              border: `1px solid ${UI.border}`,
              background: activityType === 'task' ? UI.bg : '#f3f4f6',
            }}
          />

          <label style={{ fontSize: 12, color: UI.secondary }}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              activityType === 'task'
                ? 'e.g. Confirm renewal with finance'
                : 'Optional'
            }
            style={{
              padding: 8,
              borderRadius: 10,
              border: `1px solid ${UI.border}`,
              background: UI.bg,
            }}
          />

          <label style={{ fontSize: 12, color: UI.secondary }}>Owner</label>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Optional (e.g. Corina)"
            style={{
              padding: 8,
              borderRadius: 10,
              border: `1px solid ${UI.border}`,
              background: UI.bg,
            }}
          />

          <label style={{ fontSize: 12, color: UI.secondary }}>
            Created by
          </label>
          <input
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            placeholder="Optional (your name)"
            style={{
              padding: 8,
              borderRadius: 10,
              border: `1px solid ${UI.border}`,
              background: UI.bg,
            }}
          />

          <div />
          <button
            onClick={addActivity}
            disabled={saving}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${UI.primaryBtn}`,
              background: UI.primaryBtn,
              color: '#fff',
              fontWeight: FW.strong,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              activityType === 'note' ? 'Write a note…' : 'Optional details…'
            }
            rows={3}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${UI.border}`,
              background: UI.bg,
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginTop: 6, fontSize: 12, color: UI.muted }}>
          Tip: use <b>Task</b> for follow-ups. Notes are great for “what
          happened”.
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ fontSize: 13, color: UI.secondary }}>
          Loading activities…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, color: UI.secondary }}>
          No activity yet. Add a note or create a follow-up task.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => {
            const isOverdue =
              r.activity_type === 'task' &&
              !r.is_done &&
              r.due_date &&
              new Date(r.due_date) <
                new Date(new Date().toISOString().slice(0, 10));

            return (
              <div
                key={r.id}
                style={{
                  border: `1px solid ${UI.border}`,
                  borderRadius: 12,
                  background: UI.bg,
                  padding: 10,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    lineHeight: '22px',
                    width: 26,
                    textAlign: 'center',
                  }}
                >
                  {emojiForType(r.activity_type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ fontWeight: FW.strong, color: UI.text }}>
                          {r.title ||
                            (r.activity_type === 'note'
                              ? 'Note'
                              : r.activity_type.toUpperCase())}
                        </div>

                        <span style={pillStyle}>{r.activity_type}</span>

                        {r.owner ? (
                          <span style={pillStyle}>
                            Owner: <b style={{ color: UI.text }}>{r.owner}</b>
                          </span>
                        ) : null}

                        {r.due_date ? (
                          <span
                            style={{
                              ...pillStyle,
                              borderColor: isOverdue ? UI.danger : UI.border,
                              color: isOverdue ? UI.danger : UI.secondary,
                            }}
                          >
                            Due:{' '}
                            <b
                              style={{ color: isOverdue ? UI.danger : UI.text }}
                            >
                              {r.due_date}
                            </b>
                          </span>
                        ) : null}

                        {r.is_done ? (
                          <span
                            style={{
                              ...pillStyle,
                              borderColor: UI.ok,
                              color: UI.ok,
                            }}
                          >
                            Done
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{ marginTop: 4, fontSize: 12, color: UI.muted }}
                      >
                        {fmtDate(r.created_at)}
                        {r.created_by ? (
                          <>
                            {' '}
                            · by{' '}
                            <span style={{ color: UI.secondary }}>
                              {r.created_by}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      {r.activity_type === 'task' ? (
                        <button
                          onClick={() => toggleDone(r.id, !r.is_done)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 10,
                            border: `1px solid ${UI.border}`,
                            background: UI.soft,
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          {r.is_done ? 'Reopen' : 'Mark done'}
                        </button>
                      ) : null}

                      <button
                        onClick={() => remove(r.id)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 10,
                          border: `1px solid ${UI.border}`,
                          background: UI.bg,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: UI.danger,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {r.body ? (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: UI.text,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {r.body}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
