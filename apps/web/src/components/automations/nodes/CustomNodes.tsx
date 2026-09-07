import { Handle, Position, type NodeProps } from 'reactflow';
import { Mail, Clock, GitBranch, Cog, Play } from 'lucide-react';

function NodeShell({ children, color, selected }: { children: React.ReactNode; color: string; selected?: boolean }) {
  return (
    <div className={`px-4 py-3 rounded-lg border-2 bg-white shadow-sm min-w-[180px] ${selected ? 'ring-2 ring-primary-400' : ''}`}
      style={{ borderColor: color }}>
      {children}
    </div>
  );
}

function ConfigHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[160px]">{text}</p>;
}

export function BeginNode({ selected }: NodeProps) {
  return (
    <NodeShell color="#22c55e" selected={selected}>
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-green-100 rounded">
          <Play className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-green-700">Start</p>
          <p className="text-[10px] text-gray-500">Trigger begins</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </NodeShell>
  );
}

export function EmailNode({ data, selected }: NodeProps) {
  const templateName = data?.templateName;
  return (
    <NodeShell color="#3b82f6" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-100 rounded">
          <Mail className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-blue-700">Send Email</p>
          <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{data?.label || 'Select template'}</p>
          <ConfigHint text={templateName ? `Template: ${templateName}` : undefined} />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </NodeShell>
  );
}

export function WaitNode({ data, selected }: NodeProps) {
  const waitSummary = data?.intervalNumber && data?.intervalUnit
    ? `Wait ${data.intervalNumber} ${data.intervalUnit}`
    : undefined;
  return (
    <NodeShell color="#f59e0b" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-amber-100 rounded">
          <Clock className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-amber-700">Wait</p>
          <p className="text-[10px] text-gray-500">{waitSummary || data?.label || 'Configure delay'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </NodeShell>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const conditionSummary = getConditionSummary(data?.activityFilter);
  return (
    <NodeShell color="#a855f7" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-purple-100 rounded">
          <GitBranch className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-purple-700">Condition</p>
          <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{conditionSummary || data?.label || 'Set condition'}</p>
        </div>
      </div>
      <div className="flex justify-between mt-2 text-[9px] px-1">
        <span className="text-green-600 font-medium">Yes</span>
        <span className="text-red-600 font-medium">No</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="!bg-green-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="!bg-red-500 !w-3 !h-3" />
    </NodeShell>
  );
}

export function ActionNode({ data, selected }: NodeProps) {
  const actionSummary = getActionSummary(data?.actionConfig);
  return (
    <NodeShell color="#6b7280" selected={selected}>
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-gray-100 rounded">
          <Cog className="h-4 w-4 text-gray-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700">Action</p>
          <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{actionSummary || data?.label || 'Configure action'}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-3 !h-3" />
    </NodeShell>
  );
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  add_tag: 'Add Tag',
  remove_tag: 'Remove Tag',
  add_to_list: 'Add to List',
  remove_from_list: 'Remove from List',
  update_field: 'Update Field',
  webhook: 'Webhook',
};

const OPERATOR_LABELS: Record<string, string> = {
  eq: '=', neq: '≠', contains: '~', not_empty: 'is set',
};

function getActionSummary(config: unknown): string | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;
  if (!c.action_type) return undefined;
  return ACTION_TYPE_LABELS[c.action_type as string] || (c.action_type as string);
}

function getConditionSummary(filter: unknown): string | undefined {
  if (!filter || typeof filter !== 'object') return undefined;
  const f = filter as { match?: string; rules?: Array<{ field: string; operator: string; value?: string }> };
  if (!f.rules || f.rules.length === 0) return undefined;
  const r = f.rules[0];
  const op = OPERATOR_LABELS[r.operator] || r.operator;
  if (r.operator === 'not_empty') return `${r.field} ${op}`;
  return `${r.field} ${op} ${r.value || ''}`;
}

export const nodeTypes = {
  begin: BeginNode,
  email: EmailNode,
  wait: WaitNode,
  condition: ConditionNode,
  action: ActionNode,
};
