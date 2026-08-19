import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChat } from '@ai-sdk/react'
import {
  DirectChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatTransport,
  type UIMessage,
} from 'ai'
import { Brain, Check, ChevronDown, History, Loader2, Plus, Send, Settings, Trash2, X } from 'lucide-react'
import { useChatStore } from '../../store/chatStore'
import { useLlmSettings, useSaveLlmSettings } from '../../hooks/useLlmSettings'
import { useChatHistory, useDeleteChatSession, useSaveChatHistory } from '../../hooks/useChatHistory'
import { useChatSessions } from '../../hooks/useChatSessions'
import { useAgentMemories } from '../../hooks/useAgentMemories'
import type { LlmProvider, LlmSettings } from '../../services/llmSettingsService'
import type { AgentMemory } from '../../services/agentMemoryService'
import type { ChatSessionSummary } from '../../services/chatHistoryService'
import { getCurrentSessionId, startNewSession, setCurrentSessionId } from '../../services/chatSession'
import { createChatAgent } from '../../services/chat/agent'
import { formatCurrency } from '../../utils/currency'

const PROVIDERS: { value: LlmProvider; label: string; modelHint: string }[] = [
  { value: 'anthropic', label: 'Anthropic (Claude)', modelHint: 'ex: claude-opus-5, claude-sonnet-5, claude-haiku-4-5' },
  { value: 'openai', label: 'OpenAI', modelHint: 'ID do modelo, ex: gpt-5' },
  { value: 'google', label: 'Google (Gemini)', modelHint: 'ID do modelo, ex: gemini-2.5-pro' },
  { value: 'openrouter', label: 'OpenRouter', modelHint: "ID do modelo no formato 'provider/model'" },
]

export function ChatModal() {
  const isOpen = useChatStore((s) => s.isOpen)
  const close = useChatStore((s) => s.close)
  const queryClient = useQueryClient()
  const { data: settings, isLoading: settingsLoading } = useLlmSettings()
  const [sessionId, setSessionId] = useState(() => getCurrentSessionId())
  const { data: initialMessages, isLoading: historyLoading } = useChatHistory(sessionId)
  const { data: memories, isLoading: memoriesLoading } = useAgentMemories()
  const clearHistory = useDeleteChatSession(sessionId)
  const [editingSettings, setEditingSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [hasMessages, setHasMessages] = useState(false)
  const setConversationMessagesRef = useRef<((messages: UIMessage[]) => void) | null>(null)
  const registerSetMessages = useCallback((setMessages: (messages: UIMessage[]) => void) => {
    setConversationMessagesRef.current = setMessages
  }, [])

  if (!isOpen) return null

  const showSetup = editingSettings || (!settingsLoading && !settings)
  const loading = settingsLoading || (!showSetup && (historyLoading || memoriesLoading))

  function handleClearHistory() {
    clearHistory.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(['chat-history', sessionId], [])
        setConversationMessagesRef.current?.([])
      },
    })
  }

  function handleNewChat() {
    setSessionId(startNewSession())
    setShowHistory(false)
  }

  function handleSwitchSession(id: string) {
    setCurrentSessionId(id)
    setSessionId(id)
    setShowHistory(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/60 lg:items-center lg:justify-end lg:p-6"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full lg:h-[calc(100vh-3rem)] lg:w-[460px] lg:rounded-2xl bg-card border-0 lg:border border-border flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold">{showHistory ? 'Conversas' : 'Assistente financeiro'}</h2>
          <div className="flex items-center gap-1">
            {!loading && !showSetup && (
              <button
                onClick={handleNewChat}
                aria-label="Nova conversa"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface"
              >
                <Plus size={14} />
              </button>
            )}
            {!loading && !showSetup && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                aria-label="Histórico de conversas"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface"
              >
                <History size={14} />
              </button>
            )}
            {!loading && !showSetup && !showHistory && hasMessages && (
              <button
                onClick={handleClearHistory}
                aria-label="Limpar conversa"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface"
              >
                <Trash2 size={14} />
              </button>
            )}
            {!settingsLoading && settings && !showHistory && (
              <button
                onClick={() => setEditingSettings((v) => !v)}
                aria-label="Configurar provedor"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface"
              >
                <Settings size={14} />
              </button>
            )}
            <button
              onClick={close}
              aria-label="Fechar"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted bg-surface"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : showHistory ? (
          <SessionHistoryList currentSessionId={sessionId} onSelect={handleSwitchSession} />
        ) : showSetup ? (
          <SetupForm
            initial={settings ?? null}
            onSaved={() => setEditingSettings(false)}
          />
        ) : (
          settings && (
            <Conversation
              key={sessionId}
              settings={settings}
              sessionId={sessionId}
              initialMessages={initialMessages ?? []}
              memories={memories ?? []}
              onHasMessagesChange={setHasMessages}
              onReady={registerSetMessages}
            />
          )
        )}
      </div>
    </div>
  )
}

function SessionHistoryList({
  currentSessionId,
  onSelect,
}: {
  currentSessionId: string
  onSelect: (id: string) => void
}) {
  const { data: sessions, isLoading } = useChatSessions()

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted text-center px-8">
        Nenhuma conversa salva ainda.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          isCurrent={session.id === currentSessionId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function SessionRow({
  session,
  isCurrent,
  onSelect,
}: {
  session: ChatSessionSummary
  isCurrent: boolean
  onSelect: (id: string) => void
}) {
  const deleteSession = useDeleteChatSession(session.id)

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    deleteSession.mutate(undefined, {
      onSuccess: () => {
        if (isCurrent) onSelect(startNewSession())
      },
    })
  }

  return (
    <button
      onClick={() => onSelect(session.id)}
      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2 ${
        isCurrent ? 'bg-brand/10 border border-brand/30' : 'bg-surface border border-transparent'
      }`}
    >
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-xs font-semibold truncate">{session.title}</span>
        <span className="text-[11px] text-muted">
          {new Date(session.updatedAt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <span
        role="button"
        onClick={handleDelete}
        aria-label="Excluir conversa"
        className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-muted"
      >
        <Trash2 size={13} />
      </span>
    </button>
  )
}

function SetupForm({ initial, onSaved }: { initial: LlmSettings | null; onSaved: () => void }) {
  const saveSettings = useSaveLlmSettings()
  const [provider, setProvider] = useState<LlmProvider>(initial?.provider ?? 'anthropic')
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [model, setModel] = useState(initial?.model ?? '')

  const selected = PROVIDERS.find((p) => p.value === provider)!

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim() || !model.trim()) return
    saveSettings.mutate(
      { provider, apiKey: apiKey.trim(), model: model.trim() },
      { onSuccess: onSaved },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      <p className="text-xs text-muted">
        A chave fica salva neste dispositivo e é usada para chamar o provedor direto do navegador — não passa por
        nenhum servidor do Steppwize.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Provedor</span>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as LlmProvider)}
          className="h-10 px-3 rounded-lg bg-surface border border-border text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">API key</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="h-10 px-3 rounded-lg bg-surface border border-border text-sm"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Modelo</span>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={selected.modelHint}
          className="h-10 px-3 rounded-lg bg-surface border border-border text-sm"
        />
        <span className="text-[11px] text-muted">{selected.modelHint}</span>
      </label>

      <button
        type="submit"
        disabled={saveSettings.isPending || !apiKey.trim() || !model.trim()}
        className="h-10 px-4 rounded-[10px] bg-brand text-sm font-semibold disabled:opacity-60"
      >
        {saveSettings.isPending ? 'Salvando...' : 'Salvar e continuar'}
      </button>
    </form>
  )
}

function Conversation({
  settings,
  sessionId,
  initialMessages,
  memories,
  onHasMessagesChange,
  onReady,
}: {
  settings: LlmSettings
  sessionId: string
  initialMessages: UIMessage[]
  memories: AgentMemory[]
  onHasMessagesChange: (hasMessages: boolean) => void
  onReady: (setMessages: (messages: UIMessage[]) => void) => void
}) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const saveHistory = useSaveChatHistory(sessionId)

  // Cast to the generic ChatTransport<UIMessage> — the tool-specific type param DirectChatTransport
  // infers from the agent's ToolSet is compile-time only and doesn't affect the runtime shape, but
  // it conflicts with useChat's default UIMessage generic once `messages` (persisted history) is
  // passed in too. `memories` is only read at agent construction (baked into the system prompt), so
  // new saves during this session show up starting next time the agent is (re)built — see agent.ts.
  const transport = useMemo(
    () =>
      new DirectChatTransport({
        agent: createChatAgent(settings, queryClient, memories),
      }) as unknown as ChatTransport<UIMessage>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, queryClient],
  )

  const { messages, setMessages, sendMessage, addToolApprovalResponse, addToolOutput, status, error, clearError } =
    useChat({
      transport,
      messages: initialMessages,
      // Resubmit once every pending tool call in the last step is resolved — either mutation
      // approvals (Confirmar/Cancelar) or askUserQuestion answers (no `execute`, resolved by hand
      // via addToolOutput). Neither check alone covers both cases; see tools.ts for why this is safe
      // to OR together.
      sendAutomaticallyWhen: (options) =>
        lastAssistantMessageIsCompleteWithApprovalResponses(options) ||
        lastAssistantMessageIsCompleteWithToolCalls(options),
    })

  function handleAnswerQuestion(toolCallId: string, selected: string[]) {
    addToolOutput({ tool: 'askUserQuestion', toolCallId, output: { selected } })
  }

  useEffect(() => {
    onHasMessagesChange(messages.length > 0)
  }, [messages.length, onHasMessagesChange])

  // Hands the "clear conversation" button (rendered in ChatModal's header, outside this component)
  // a direct way to reset local state — simpler and race-free compared to remounting Conversation.
  useEffect(() => {
    onReady(setMessages)
  }, [onReady, setMessages])

  // Debounced full-array persist — `messages` changes on every streamed token, so writing on every
  // change would hammer PGlite during a response; the delay coalesces those into one write. A ref
  // (rather than the `messages` closure) is read from the flush effects below so a pending save
  // isn't lost by unmounting before the debounce fires (e.g. the user closes the modal right after
  // sending).
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    // Skip persisting an empty conversation — a freshly-opened/new session has none yet, and
    // saving here would write a blank row that clutters the history list before the user types.
    if (messages.length === 0) return
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = undefined
      saveHistory.mutate(messagesRef.current)
    }, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        if (messagesRef.current.length > 0) saveHistory.mutate(messagesRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage({ text })
  }

  const busy = status === 'submitted' || status === 'streaming'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted text-center py-8">
            Pergunte sobre suas transações, contas ou peça pra categorizar/editar algo.
          </p>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onApprove={addToolApprovalResponse}
            onAnswerQuestion={handleAnswerQuestion}
          />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-muted text-xs">
            <Loader2 size={12} className="animate-spin" /> pensando...
          </div>
        )}
        {error && (
          <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-negative/10 border border-negative/30">
            <p className="text-xs text-negative">{error.message || 'Falha ao chamar o provedor de LLM.'}</p>
            <button onClick={clearError} className="self-start text-xs font-semibold text-negative underline">
              Dispensar
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-border shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={busy}
          className="flex-1 h-10 px-3 rounded-lg bg-surface border border-border text-sm disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Enviar"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand disabled:opacity-60 shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}

type ApproveFn = (args: { id: string; approved: boolean; reason?: string }) => void | PromiseLike<void>
type AnswerQuestionFn = (toolCallId: string, selected: string[]) => void

interface QuestionInput {
  question: string
  options: { label: string; description?: string }[]
  multiSelect?: boolean
}

interface ApprovalToolPart {
  type: string
  toolCallId: string
  input: unknown
  approval: { id: string }
}

function MessageBubble({
  message,
  onApprove,
  onAnswerQuestion,
}: {
  message: UIMessage
  onApprove: ApproveFn
  onAnswerQuestion: AnswerQuestionFn
}) {
  const isUser = message.role === 'user'

  // When the model fires off several mutating calls in the same turn (e.g. it ignored the
  // bulk-tool guidance and called updateTransactionCategory in a loop), collapse them into one
  // "Confirmar tudo" bar instead of a separate approval card + click per item — see BulkApprovalBar.
  const approvalParts = message.parts.filter(
    (part): part is UIMessage['parts'][number] & ApprovalToolPart =>
      part.type.startsWith('tool-') &&
      part.type !== 'tool-askUserQuestion' &&
      (part as unknown as { state: string }).state === 'approval-requested',
  )

  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          if (!part.text) return null
          return (
            <div
              key={i}
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                isUser ? 'bg-brand text-white' : 'bg-surface border border-border'
              }`}
            >
              {part.text}
            </div>
          )
        }

        if (part.type === 'reasoning') {
          return <ReasoningBlock key={i} text={part.text} state={part.state} />
        }

        if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
          const toolPart = part as unknown as {
            type: string
            toolCallId: string
            state: string
            input?: unknown
            errorText?: string
            approval?: { id: string }
          }
          const toolName = part.type === 'dynamic-tool' ? 'ferramenta' : part.type.slice(5)

          if (part.type === 'tool-askUserQuestion' && toolPart.state === 'input-available') {
            return (
              <AskQuestionCard
                key={i}
                toolCallId={toolPart.toolCallId}
                input={toolPart.input as QuestionInput}
                onAnswer={onAnswerQuestion}
              />
            )
          }

          // Rendered together after this .map() via BulkApprovalBar once there's more than one.
          if (toolPart.state === 'approval-requested' && toolPart.approval && approvalParts.length <= 1) {
            return (
              <ApprovalCard
                key={i}
                toolName={toolName}
                input={toolPart.input}
                approvalId={toolPart.approval.id}
                onApprove={onApprove}
              />
            )
          }
          if (toolPart.state === 'approval-requested') return null

          if (toolPart.state === 'output-error') {
            return (
              <p key={i} className="text-xs text-negative">
                Erro em {toolName}: {toolPart.errorText}
              </p>
            )
          }

          return (
            <p key={i} className="text-[11px] text-muted italic">
              {toolName}...
            </p>
          )
        }

        return null
      })}

      {approvalParts.length > 1 && <BulkApprovalBar parts={approvalParts} onApprove={onApprove} />}
    </div>
  )
}

// Best-effort human-readable summary of a mutating tool call, using the display-only fields the
// model is instructed to fill in (see tools.ts) — falls back to the tool name alone if a field is
// missing rather than showing "undefined" (the model occasionally skips optional-looking fields).
function describeToolCall(toolName: string, input: unknown): string {
  const data = (input ?? {}) as Record<string, unknown>
  try {
    switch (toolName) {
      case 'createTransaction':
        return `Criar transação "${req(data.description)}" de ${formatCurrency(Number(data.value))} em ${req(data.accountName)}, categoria ${req(data.categoryName)}, vence ${req(data.dueDate)}`
      case 'updateTransaction': {
        const inner = (data.input ?? {}) as Record<string, unknown>
        return `Atualizar transação "${req(inner.description)}" para ${formatCurrency(Number(inner.value))} em ${req(inner.accountName)}, categoria ${req(inner.categoryName)}, vence ${req(inner.dueDate)}`
      }
      case 'updateTransactionCategory':
        return `Categorizar "${req(data.description)}" como ${req(data.categoryName)}`
      case 'deleteTransaction':
        return `Remover a transação "${req(data.description)}"`
      case 'applyRules':
        return data.invoiceId ? 'Aplicar regras de categorização a esta fatura' : 'Aplicar regras de categorização às transações sem categoria'
      case 'updateFixedTransaction': {
        const inner = (data.input ?? {}) as Record<string, unknown>
        return `Atualizar fixo "${req(inner.description)}" para ${formatCurrency(Number(inner.value))} em ${req(inner.accountName)}, categoria ${req(inner.categoryName)}, a partir de ${req(inner.startDate)}`
      }
      case 'deleteFixedTransaction':
        return `Remover o fixo "${req(data.description)}"`
      default:
        return toolName
    }
  } catch {
    return toolName
  }
}

function req(value: unknown): string {
  if (value === undefined || value === null || value === '') throw new Error('missing field')
  return String(value)
}

function ApprovalCard({
  toolName,
  input,
  approvalId,
  onApprove,
}: {
  toolName: string
  input: unknown
  approvalId: string
  onApprove: ApproveFn
}) {
  const data = (input ?? {}) as { updates?: { description?: string; categoryName?: string }[] }

  return (
    <div className="max-w-[90%] w-full p-3 rounded-2xl bg-surface border border-border flex flex-col gap-2">
      {toolName === 'updateTransactionsCategoryBulk' && Array.isArray(data.updates) ? (
        <>
          <p className="text-xs font-semibold">Recategorizar {data.updates.length} transações:</p>
          <ul className="text-[11px] text-muted flex flex-col gap-1 max-h-40 overflow-y-auto">
            {data.updates.map((u, idx) => (
              <li key={idx}>
                {u.description ?? '—'} → <span className="text-white">{u.categoryName ?? '—'}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs">{describeToolCall(toolName, input)}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => onApprove({ id: approvalId, approved: false })}
          className="h-8 px-3 rounded-lg text-xs font-semibold text-muted"
        >
          Cancelar
        </button>
        <button
          onClick={() => onApprove({ id: approvalId, approved: true })}
          className="h-8 px-3 rounded-lg text-xs font-semibold bg-brand flex items-center gap-1.5"
        >
          <Check size={12} /> Confirmar
        </button>
      </div>
    </div>
  )
}

function BulkApprovalBar({ parts, onApprove }: { parts: ApprovalToolPart[]; onApprove: ApproveFn }) {
  const [processing, setProcessing] = useState(false)

  // Sequential and awaited on purpose: `onApprove` (addToolApprovalResponse) can trigger an
  // auto-resubmit once it sees every approval in the step resolved. Firing all N synchronously in a
  // tight loop races that check against still-in-flight state updates — some calls can see a
  // "complete" snapshot before every response actually landed, resubmitting to the provider with
  // tool_use blocks that don't all have a tool_result yet (hard API error). Awaiting each one before
  // starting the next guarantees the check only ever sees a fully-consistent state.
  async function approveAll(approved: boolean) {
    setProcessing(true)
    try {
      for (const part of parts) {
        await onApprove({ id: part.approval.id, approved })
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="max-w-[90%] w-full p-3 rounded-2xl bg-surface border border-border flex flex-col gap-2">
      <p className="text-xs font-semibold">Confirmar {parts.length} ações:</p>
      <ul className="text-[11px] text-muted flex flex-col gap-1 max-h-40 overflow-y-auto">
        {parts.map((part) => (
          <li key={part.toolCallId}>{describeToolCall(part.type.slice(5), part.input)}</li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => approveAll(false)}
          disabled={processing}
          className="h-8 px-3 rounded-lg text-xs font-semibold text-muted disabled:opacity-60"
        >
          Cancelar todas
        </button>
        <button
          onClick={() => approveAll(true)}
          disabled={processing}
          className="h-8 px-3 rounded-lg text-xs font-semibold bg-brand flex items-center gap-1.5 disabled:opacity-60"
        >
          <Check size={12} /> Confirmar todas
        </button>
      </div>
    </div>
  )
}

// Live-updating reasoning/thinking block — only appears at all for models that actually emit
// reasoning content (e.g. Claude Opus 5 thinks by default; most others don't unless the user's
// chosen model is configured for it, which this app doesn't expose a toggle for). Expanded while
// `state === 'streaming'` so the text visibly grows token by token; collapses itself the moment
// streaming finishes, exactly like Claude Code/Copilot's "Thought for Ns" — still togglable by hand
// afterward for anyone who wants to read it.
function ReasoningBlock({ text, state }: { text: string; state?: 'streaming' | 'done' }) {
  const [expanded, setExpanded] = useState(() => state === 'streaming')
  const wasStreamingRef = useRef(state === 'streaming')

  useEffect(() => {
    if (wasStreamingRef.current && state === 'done') setExpanded(false)
    wasStreamingRef.current = state === 'streaming'
  }, [state])

  return (
    <div className="max-w-[90%] w-full flex flex-col gap-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted"
      >
        <Brain size={12} className={state === 'streaming' ? 'animate-pulse text-brand' : ''} />
        <span className="italic">{state === 'streaming' ? 'Pensando...' : 'Raciocínio'}</span>
        <ChevronDown size={10} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <p className="text-[11px] text-muted whitespace-pre-wrap break-words border-l-2 border-border pl-2 ml-1">
          {text || '...'}
        </p>
      )}
    </div>
  )
}

function AskQuestionCard({
  toolCallId,
  input,
  onAnswer,
}: {
  toolCallId: string
  input: QuestionInput
  onAnswer: AnswerQuestionFn
}) {
  const multiSelect = input.multiSelect ?? false
  const [selected, setSelected] = useState<string[]>([])
  // Enforced here rather than relying on the model to add it — guarantees an escape hatch even if
  // none of the predefined options fit, regardless of what the model's `options` array contains.
  const [customMode, setCustomMode] = useState(false)
  const [customText, setCustomText] = useState('')

  function toggle(label: string) {
    if (!multiSelect) {
      onAnswer(toolCallId, [label])
      return
    }
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]))
  }

  function submitCustom() {
    const text = customText.trim()
    if (!text) return
    onAnswer(toolCallId, [text])
  }

  if (customMode) {
    return (
      <div className="max-w-[90%] w-full p-3 rounded-2xl bg-surface border border-border flex flex-col gap-2">
        <p className="text-xs font-semibold">{input.question}</p>
        <input
          autoFocus
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitCustom()
          }}
          placeholder="Digite sua resposta..."
          className="h-9 px-3 rounded-lg bg-card border border-border text-xs"
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setCustomMode(false)} className="h-8 px-3 rounded-lg text-xs font-semibold text-muted">
            Voltar
          </button>
          <button
            onClick={submitCustom}
            disabled={!customText.trim()}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-brand disabled:opacity-60"
          >
            Enviar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[90%] w-full p-3 rounded-2xl bg-surface border border-border flex flex-col gap-2">
      <p className="text-xs font-semibold">{input.question}</p>
      <div className="flex flex-col gap-1.5">
        {input.options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => toggle(opt.label)}
            className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
              selected.includes(opt.label) ? 'border-brand bg-brand/10' : 'border-border bg-card'
            }`}
          >
            <div className="font-semibold">{opt.label}</div>
            {opt.description && <div className="text-muted mt-0.5">{opt.description}</div>}
          </button>
        ))}
        <button
          onClick={() => setCustomMode(true)}
          className="text-left px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted"
        >
          Outro (escrever resposta)
        </button>
      </div>
      {multiSelect && (
        <button
          onClick={() => onAnswer(toolCallId, selected)}
          disabled={selected.length === 0}
          className="self-end h-8 px-3 rounded-lg text-xs font-semibold bg-brand disabled:opacity-60"
        >
          Confirmar
        </button>
      )}
    </div>
  )
}
