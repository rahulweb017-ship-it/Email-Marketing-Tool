import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  addEdge, useNodesState, useEdgesState, Controls, Background, MiniMap,
  type Connection, type Node, type Edge, type NodeChange, type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowLeft, Save, Mail, Clock, GitBranch, Cog, Trash2 } from 'lucide-react';
import { nodeTypes } from '../components/automations/nodes/CustomNodes';
import ActivityConfigModal from '../components/automations/ActivityConfigModal';
import { ButtonSpinner, PageLoader } from '../components/ui/Spinner';
import { useToastStore } from '../stores/toast.store';
import api from '../api/client';

interface Activity {
  id: string;
  name: string;
  activity_type: string;
  trigger_type: string;
  parent_id: string | null;
  parent_handle: string | null;
  interval_number: number;
  interval_unit: string;
  position_x: number;
  position_y: number;
  email_template_id: string | null;
  action_config: Record<string, unknown>;
  activity_filter: unknown;
}

const PALETTE_ITEMS = [
  { type: 'email', label: 'Send Email', icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30', trigger: 'activity_completed', activityType: 'email' },
  { type: 'wait', label: 'Wait', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30', trigger: 'activity_completed', activityType: 'wait' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30', trigger: 'activity_completed', activityType: 'condition' },
  { type: 'action', label: 'Action', icon: Cog, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', trigger: 'activity_completed', activityType: 'action' },
];

const TYPE_MAP: Record<string, string> = {
  email: 'email', sms: 'email', wait: 'wait', condition: 'condition', action: 'action',
};

function parseJsonField(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

function activitiesToFlow(activities: Activity[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  activities.forEach((a) => {
    const nodeType = a.trigger_type === 'begin' ? 'begin' : (TYPE_MAP[a.activity_type] || 'action');
    const actionConfig = parseJsonField(a.action_config);
    const activityFilter = parseJsonField(a.activity_filter);

    nodes.push({
      id: a.id,
      type: nodeType,
      position: { x: a.position_x || 0, y: a.position_y || 0 },
      data: {
        label: a.name,
        activityId: a.id,
        interval: a.interval_number ? `${a.interval_number} ${a.interval_unit}` : undefined,
        intervalNumber: a.interval_number,
        intervalUnit: a.interval_unit,
        actionConfig,
        activityFilter,
        emailTemplateId: a.email_template_id,
      },
    });

    if (a.parent_id) {
      edges.push({
        id: `e-${a.parent_id}-${a.id}`,
        source: a.parent_id,
        target: a.id,
        sourceHandle: a.parent_handle || undefined,
        animated: true,
        style: { strokeWidth: 2, stroke: '#6366f1' },
      });
    }
  });

  return { nodes, edges };
}

export default function AutomationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [automationName, setAutomationName] = useState('');
  const [sender, setSender] = useState({ email_from: '', reply_to: '' });
  const savedSender = useRef({ email_from: '', reply_to: '' });
  const [audience, setAudience] = useState({ list_id: '', segment_id: '' });
  const [audienceOptions, setAudienceOptions] = useState<{ lists: { id: string; name: string }[]; segments: { id: string; name: string }[] }>({ lists: [], segments: [] });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [configActivity, setConfigActivity] = useState<Activity | null>(null);
  const activitiesRef = useRef<Activity[]>([]);

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  const saveAudience = async (next: { list_id: string; segment_id: string }) => {
    if (!id) return;
    setAudience(next);
    const target_filter = [
      ...(next.list_id ? [{ field: 'list', operator: 'in_list', value: next.list_id }] : []),
      ...(next.segment_id ? [{ field: 'segment', operator: 'in_segment', value: next.segment_id }] : []),
    ];
    try {
      await api.patch(`/automations/${id}`, { target_filter });
      addToast('Audience saved', 'success');
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Could not save the audience', 'error');
    }
  };

  useEffect(() => {
    api.get('/automations/lists').then((r) => setAudienceOptions((o) => ({ ...o, lists: r.data || [] }))).catch(() => {});
    api.get('/segments', { params: { per_page: 100 } }).then((r) => setAudienceOptions((o) => ({ ...o, segments: r.data?.data || [] }))).catch(() => {});
  }, []);
  const saveSender = async () => {
    if (!id) return;
    if (sender.email_from === savedSender.current.email_from && sender.reply_to === savedSender.current.reply_to) return;
    try {
      await api.patch(`/automations/${id}`, { email_from: sender.email_from.trim() || null, reply_to: sender.reply_to.trim() || null });
      savedSender.current = { ...sender };
      addToast('Sender saved', 'success');
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Enter a valid email address', 'error');
    }
  };

  const loadAutomation = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get(`/automations/${id}`);
      setAutomationName(data.name);
      const s = { email_from: data.email_from || '', reply_to: data.reply_to || '' };
      setSender(s);
      savedSender.current = s;
      const targets: { operator: string; value: string }[] = Array.isArray(data.target_filter) ? data.target_filter : [];
      setAudience({
        list_id: targets.find((t) => t.operator === 'in_list')?.value || '',
        segment_id: targets.find((t) => t.operator === 'in_segment')?.value || '',
      });
      const activities: Activity[] = data.activities || [];
      activitiesRef.current = activities;

      // Auto-create begin activity if none exists
      const hasBegin = activities.some((a: Activity) => a.trigger_type === 'begin');
      if (!hasBegin) {
        const { data: beginActivity } = await api.post('/automations/activities', {
          campaign_id: id,
          name: 'Start',
          activity_type: 'email',
          trigger_type: 'begin',
          position_x: 250,
          position_y: 50,
        });
        activities.push(beginActivity);
        activitiesRef.current = activities;
      }

      const { nodes: n, edges: e } = activitiesToFlow(activities);
      setNodes(n);
      setEdges(e);
    } catch {
      addToast('Failed to load automation', 'error');
      navigate('/automations');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, addToast, setNodes, setEdges]);

  useEffect(() => { loadAutomation(); }, [loadAutomation]);

  const onConnect = useCallback(async (connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true, style: { strokeWidth: 2, stroke: '#6366f1' } }, eds));
    if (connection.target) {
      try {
        await api.patch(`/automations/activities/${connection.target}`, {
          parent_id: connection.source,
          parent_handle: connection.sourceHandle || null,
        });
      } catch {
        addToast('Failed to save connection', 'error');
      }
    }
  }, [setEdges, addToast]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    for (const change of changes) {
      if (change.type === 'select' && change.selected) {
        setSelectedNode(change.id);
      }
    }
  }, [onNodesChange]);

  const handleEdgesChange = useCallback(async (changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === 'remove') {
        const edge = edges.find((e) => e.id === change.id);
        if (edge) {
          try {
            await api.patch(`/automations/activities/${edge.target}`, { parent_id: null, parent_handle: null });
          } catch {
            // silent
          }
        }
      }
    }
    onEdgesChange(changes);
  }, [onEdgesChange, edges]);

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type === 'begin') return;
    const activity = activitiesRef.current.find((a) => a.id === node.id);
    if (activity) {
      // Parse JSON string fields for the modal
      const parsed: Activity = {
        ...activity,
        action_config: (typeof activity.action_config === 'string' ? JSON.parse(activity.action_config) : activity.action_config) || {},
        activity_filter: typeof activity.activity_filter === 'string' ? JSON.parse(activity.activity_filter) : activity.activity_filter,
      };
      setConfigActivity(parsed);
    }
  }, []);

  const addNode = async (paletteItem: typeof PALETTE_ITEMS[0]) => {
    if (!id) return;
    try {
      await api.post('/automations/activities', {
        campaign_id: id,
        name: paletteItem.label,
        activity_type: paletteItem.activityType,
        trigger_type: paletteItem.trigger,
        position_x: 250,
        position_y: (nodes.length + 1) * 150,
      });

      await loadAutomation();
      addToast(`${paletteItem.label} added`, 'success');
    } catch {
      addToast('Failed to add activity', 'error');
    }
  };

  const deleteSelectedNode = async () => {
    if (!selectedNode) return;
    const node = nodes.find((n) => n.id === selectedNode);
    if (!node || node.type === 'begin') {
      addToast('Cannot delete the Start node', 'error');
      return;
    }
    try {
      await api.delete(`/automations/activities/${selectedNode}`);
      setSelectedNode(null);
      await loadAutomation();
      addToast('Activity deleted', 'success');
    } catch {
      addToast('Failed to delete activity', 'error');
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      for (const node of nodes) {
        const edge = edges.find((e) => e.target === node.id);
        await api.patch(`/automations/activities/${node.id}`, {
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
          parent_id: edge?.source || null,
          parent_handle: edge?.sourceHandle || null,
        });
      }
      addToast('Workflow saved', 'success');
    } catch {
      addToast('Failed to save workflow', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col h-screen dark:bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/automations')} className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          <h1 className="font-semibold dark:text-gray-100">{automationName || 'Automation Editor'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {selectedNode && nodes.find((n) => n.id === selectedNode)?.type !== 'begin' && (
            <button onClick={deleteSelectedNode}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              <Trash2 className="h-4 w-4" /> Delete Selected
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
            {saving ? <ButtonSpinner /> : <Save className="h-4 w-4" />}
            Save Workflow
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left palette */}
        <div className="w-56 bg-white dark:bg-gray-800 border-r dark:border-gray-700 p-4 space-y-3 flex-shrink-0 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Activities</h3>
          {PALETTE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.type} onClick={() => addNode(item)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border dark:border-gray-600 hover:border-primary-400 hover:shadow-sm transition-all ${item.bg}`}>
                <Icon className={`h-5 w-5 ${item.color}`} />
                <span className="text-sm font-medium dark:text-gray-200">{item.label}</span>
              </button>
            );
          })}
          <div className="pt-3 border-t dark:border-gray-700 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Audience</h3>
            <select aria-label="Audience list" value={audience.list_id} onChange={(e) => saveAudience({ ...audience, list_id: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
              <option value="">Any list</option>
              {audienceOptions.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select aria-label="Audience segment" value={audience.segment_id} onChange={(e) => saveAudience({ ...audience, segment_id: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
              <option value="">No segment</option>
              {audienceOptions.segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {audience.list_id || audience.segment_id ? 'Matching contacts join within about 5 minutes of starting.' : 'Choose a list, a segment or both before starting.'}
            </p>
          </div>          <div className="pt-3 border-t dark:border-gray-700 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Sender</h3>
            <input type="email" placeholder="From email" value={sender.email_from}
              onChange={(e) => setSender((s) => ({ ...s, email_from: e.target.value }))} onBlur={saveSender}
              className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            <input type="email" placeholder="Reply-to (optional)" value={sender.reply_to}
              onChange={(e) => setSender((s) => ({ ...s, reply_to: e.target.value }))} onBlur={saveSender}
              className="w-full px-2 py-1.5 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            <p className="text-xs text-gray-400 dark:text-gray-500">Used by Send Email steps. Leave empty to use your latest campaign's sender.</p>
          </div>
          <div className="pt-3 border-t dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500">Click an activity to add it. Double-click a node to configure it. Connect nodes by dragging between handles.</p>
          </div>
        </div>

        {/* ReactFlow Canvas */}
        <div className="flex-1 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={memoizedNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={['Backspace', 'Delete']}
            onNodesDelete={async (deleted) => {
              for (const node of deleted) {
                if (node.type === 'begin') continue;
                try {
                  await api.delete(`/automations/activities/${node.id}`);
                } catch { /* silent */ }
              }
              setSelectedNode(null);
            }}
          >
            <Controls />
            <Background gap={20} size={1} />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
          </ReactFlow>
        </div>
      </div>

      {configActivity && (
        <ActivityConfigModal
          activity={configActivity}
          onClose={() => setConfigActivity(null)}
          onSaved={() => loadAutomation()}
        />
      )}
    </div>
  );
}
