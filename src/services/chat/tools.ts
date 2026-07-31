import type { QueryClient } from '@tanstack/react-query'
import { tool, type ToolApprovalConfiguration, type ToolSet } from 'ai'
import { z } from 'zod'
import { getAccounts, getHomeCashFlow } from '../../api/accounts'
import { listMemories, saveMemory } from '../../api/agentMemories'
import { getCards, getInvoice, getInvoicePreview } from '../../api/cards'
import { getCategories } from '../../api/categories'
import {
  deleteFixedTransaction,
  getFixedTransactions,
  updateFixedTransaction,
  type FixedTransactionInput,
} from '../../api/fixedTransactions'
import { applyRules } from '../../api/rules'
import {
  createTransaction,
  deleteTransaction,
  getAccountPreview,
  getTransactions,
  updateTransaction,
  updateTransactionCategory,
  type TransactionInput,
} from '../../api/transactions'

// Tool names that mutate data — gated behind human-in-the-loop approval via `toolApproval` on the
// ToolLoopAgent (see services/chat/agent.ts). Kept as a const list so agent.ts can build the
// approval map without duplicating tool names.
export const MUTATING_TOOL_NAMES = [
  'createTransaction',
  'updateTransaction',
  'updateTransactionCategory',
  'updateTransactionsCategoryBulk',
  'deleteTransaction',
  'applyRules',
  'updateFixedTransaction',
  'deleteFixedTransaction',
] as const

export function buildToolApprovalConfig(): ToolApprovalConfiguration<ToolSet, never> {
  const config: Record<string, 'user-approval'> = {}
  for (const name of MUTATING_TOOL_NAMES) config[name] = 'user-approval'
  return config
}

// `accountName`/`categoryName` are display-only — the model already has them from prior
// listAccounts/listCards/listCategories calls, so passing them along costs nothing and lets the
// confirmation card show human-readable text instead of raw ids. `execute`/toTransactionInput
// ignore them; the DB write still only uses accountId/categoryId.
const transactionInputSchema = z.object({
  description: z.string().describe('Descrição da transação'),
  value: z.number().describe('Valor com sinal: positivo para receita, negativo para despesa'),
  accountId: z.string().describe('ID da conta ou cartão'),
  accountName: z.string().describe('Nome da conta ou cartão — apenas para exibir ao usuário na confirmação'),
  categoryId: z.string().nullable().describe('ID da categoria, ou null se não categorizada'),
  categoryName: z.string().describe('Nome da categoria, ou "Sem categoria" — apenas para exibir ao usuário na confirmação'),
  dueDate: z.string().describe("Data no formato 'YYYY-MM-DD'"),
  paidOut: z.boolean().describe('Se a transação já foi paga/efetivada'),
})

function toTransactionInput(input: z.infer<typeof transactionInputSchema>): TransactionInput {
  return input
}

// Same display-only convenience as transactionInputSchema above (accountName/categoryName ignored by execute).
const fixedTransactionInputSchema = z.object({
  description: z.string().describe('Descrição do lançamento fixo'),
  value: z.number().describe('Valor com sinal: positivo para receita, negativo para despesa'),
  accountId: z.string().describe('ID da conta bancária'),
  accountName: z.string().describe('Nome da conta — apenas para exibir ao usuário na confirmação'),
  categoryId: z.string().nullable().describe('ID da categoria, ou null se não categorizada'),
  categoryName: z.string().describe('Nome da categoria, ou "Sem categoria" — apenas para exibir ao usuário na confirmação'),
  startDate: z.string().describe("Data a partir da qual o fixo passa a valer, no formato 'YYYY-MM-DD' — o dia do mês é o que aparece nas previsões"),
  endDate: z.string().nullable().describe("Data final (inclusive), 'YYYY-MM-DD', ou null se não tiver fim (ex: aluguel, salário)"),
})

function toFixedTransactionInput(input: z.infer<typeof fixedTransactionInputSchema>): FixedTransactionInput {
  return input
}

// Every mutating tool's `execute` performs the real write via the same api/* wrappers the UI uses —
// the human-in-the-loop pause happens before `execute` runs (see MUTATING_TOOL_NAMES / toolApproval),
// not inside it. `queryClient` is passed in so a confirmed mutation invalidates the same query keys
// TransactionsPage relies on, mirroring useInvalidateTransactions in hooks/useTransactions.ts.
export function buildChatTools(queryClient: QueryClient): ToolSet {
  function invalidateTransactions() {
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['account-preview'] })
    queryClient.invalidateQueries({ queryKey: ['home-cash-flow'] })
  }

  return {
    listTransactions: tool({
      description: 'Lista as transações de um mês/ano específico, incluindo o resumo do mês anterior por conta.',
      inputSchema: z.object({
        month: z.number().int().min(1).max(12).describe('Mês (1-12)'),
        year: z.number().int().describe('Ano, ex: 2026'),
      }),
      execute: async ({ month, year }) => getTransactions(month, year),
    }),

    listAccounts: tool({
      description: 'Lista as contas bancárias do usuário, com saldo calculado.',
      inputSchema: z.object({}),
      execute: async () => getAccounts(),
    }),

    listCards: tool({
      description: 'Lista os cartões de crédito do usuário.',
      inputSchema: z.object({}),
      execute: async () => getCards(),
    }),

    getHomeCashFlow: tool({
      description: 'Retorna o resumo geral de saldos (contas + cartões) exibido na tela inicial.',
      inputSchema: z.object({}),
      execute: async () => getHomeCashFlow(),
    }),

    getInvoice: tool({
      description: 'Retorna a fatura real (já fechada) de um cartão para um mês/ano.',
      inputSchema: z.object({
        cardId: z.string(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      }),
      execute: async ({ cardId, year, month }) => getInvoice(cardId, year, month),
    }),

    getInvoicePreview: tool({
      description: 'Estima a fatura de um cartão para um mês/ano que ainda não tem fatura real.',
      inputSchema: z.object({
        cardId: z.string(),
        year: z.number().int(),
        month: z.number().int().min(1).max(12),
      }),
      execute: async ({ cardId, year, month }) => getInvoicePreview(cardId, year, month),
    }),

    getAccountPreview: tool({
      description:
        'Estima as transações de uma conta bancária para um mês/ano que ainda não tem lançamentos reais, a partir dos fixos cadastrados (fixed_transactions) e da média por categoria. Use esta tool (não listTransactions) quando o usuário mencionar itens "fixos", "recorrentes" ou "previstos" de uma conta em um mês futuro/vazio.',
      inputSchema: z.object({
        year: z.number().int().describe('Ano, ex: 2026'),
        month: z.number().int().min(1).max(12).describe('Mês (1-12)'),
      }),
      execute: async ({ year, month }) => getAccountPreview(year, month),
    }),

    listFixedTransactions: tool({
      description:
        'Lista os lançamentos fixos/recorrentes cadastrados (aluguel, salário, assinaturas etc) para contas bancárias. Cada um tem uma startDate cujo dia do mês é o dia em que aparece nas previsões (getAccountPreview) — para mudar esse dia, edite a startDate via updateFixedTransaction.',
      inputSchema: z.object({}),
      execute: async () => getFixedTransactions(),
    }),

    updateFixedTransaction: tool({
      description:
        'Atualiza um lançamento fixo/recorrente existente (ex: mudar o dia do mês, valor, conta ou categoria). Requer confirmação do usuário antes de executar.',
      inputSchema: z.object({ id: z.string(), input: fixedTransactionInputSchema }),
      execute: async ({ id, input }) => {
        const result = await updateFixedTransaction(id, toFixedTransactionInput(input))
        queryClient.invalidateQueries({ queryKey: ['fixed-transactions'] })
        queryClient.invalidateQueries({ queryKey: ['account-preview'] })
        return result
      },
    }),

    deleteFixedTransaction: tool({
      description:
        'Remove (soft delete) um lançamento fixo/recorrente cadastrado. Requer confirmação do usuário antes de executar.',
      inputSchema: z.object({
        id: z.string(),
        description: z.string().describe('Descrição do lançamento fixo — apenas para exibir ao usuário na confirmação'),
      }),
      execute: async ({ id }) => {
        const result = await deleteFixedTransaction(id)
        queryClient.invalidateQueries({ queryKey: ['fixed-transactions'] })
        queryClient.invalidateQueries({ queryKey: ['account-preview'] })
        return result
      },
    }),

    listCategories: tool({
      description: 'Lista as categorias de transação cadastradas (em árvore, com subcategorias).',
      inputSchema: z.object({}),
      execute: async () => getCategories(),
    }),

    createTransaction: tool({
      description: 'Cria uma nova transação. Requer confirmação do usuário antes de executar.',
      inputSchema: transactionInputSchema,
      execute: async (input) => {
        const result = await createTransaction(toTransactionInput(input))
        invalidateTransactions()
        return result
      },
    }),

    updateTransaction: tool({
      description: 'Atualiza todos os campos de uma transação existente. Requer confirmação do usuário antes de executar.',
      inputSchema: z.object({ id: z.string(), input: transactionInputSchema }),
      execute: async ({ id, input }) => {
        const result = await updateTransaction(id, toTransactionInput(input))
        invalidateTransactions()
        return result
      },
    }),

    updateTransactionCategory: tool({
      description:
        'Altera apenas a categoria de UMA transação. Para duas ou mais transações no mesmo pedido, use updateTransactionsCategoryBulk em vez de chamar esta tool várias vezes — evita pedir uma confirmação separada pra cada uma. Requer confirmação do usuário antes de executar.',
      inputSchema: z.object({
        id: z.string(),
        description: z.string().describe('Descrição da transação — apenas para exibir ao usuário na confirmação'),
        categoryId: z.string().nullable().describe('ID da nova categoria, ou null para remover a categoria'),
        categoryName: z.string().describe('Nome da nova categoria, ou "Sem categoria" — apenas para exibir ao usuário na confirmação'),
      }),
      execute: async ({ id, categoryId }) => {
        const result = await updateTransactionCategory(id, categoryId)
        invalidateTransactions()
        return result
      },
    }),

    // Fixes a real friction point: asking to recategorize N transactions used to mean N separate
    // approval prompts, each showing a raw categoryId the user can't read. One call here = one
    // approval, with a human-readable list (see describeToolCall/ApprovalPreview in ChatModal.tsx).
    updateTransactionsCategoryBulk: tool({
      description:
        'Atualiza a categoria de VÁRIAS transações de uma vez, com uma única confirmação do usuário. Use esta tool (não updateTransactionCategory em loop) sempre que o pedido envolver recategorizar duas ou mais transações.',
      inputSchema: z.object({
        updates: z
          .array(
            z.object({
              id: z.string(),
              description: z.string().describe('Descrição da transação — apenas para exibir ao usuário'),
              categoryId: z.string().nullable(),
              categoryName: z.string().describe('Nome da nova categoria, ou "Sem categoria" — apenas para exibir ao usuário'),
            }),
          )
          .min(1),
      }),
      execute: async ({ updates }) => {
        const results = []
        for (const { id, categoryId } of updates) {
          results.push(await updateTransactionCategory(id, categoryId))
        }
        invalidateTransactions()
        return { updated: results.length }
      },
    }),

    deleteTransaction: tool({
      description: 'Remove (soft delete) uma transação. Requer confirmação do usuário antes de executar.',
      inputSchema: z.object({
        id: z.string(),
        description: z.string().describe('Descrição da transação — apenas para exibir ao usuário na confirmação'),
      }),
      execute: async ({ id }) => {
        const result = await deleteTransaction(id)
        invalidateTransactions()
        return result
      },
    }),

    applyRules: tool({
      description:
        'Aplica as regras de categorização ativas às transações sem categoria (ou de uma fatura específica). Requer confirmação do usuário antes de executar.',
      inputSchema: z.object({
        invoiceId: z.string().optional().describe('Limitar a uma fatura específica'),
        onlyUncategorized: z.boolean().optional().default(true).describe('Se true, só afeta transações ainda categorizadas como "Outros"'),
      }),
      execute: async ({ invoiceId, onlyUncategorized }) => {
        const result = await applyRules(invoiceId, onlyUncategorized)
        invalidateTransactions()
        return result
      },
    }),

    // Own scratchpad — not user financial data, so no approval gate. New entries only take effect
    // in the system prompt of a *future* session (see buildSystemPrompt in agent.ts); they're not
    // injected mid-conversation.
    saveMemory: tool({
      description:
        'Salva uma memória curta e reutilizável para lembrar em conversas futuras — preferências do usuário, contexto recorrente, correções que ele já fez antes. Não use para dados de transações/contas, que já ficam salvos no banco. Passa a valer a partir da próxima conversa, não na atual.',
      inputSchema: z.object({ content: z.string().describe('Texto curto e autocontido da memória') }),
      execute: async ({ content }) => {
        const result = await saveMemory(content)
        queryClient.invalidateQueries({ queryKey: ['agent-memories'] })
        return result
      },
    }),

    listMemories: tool({
      description:
        'Lista todas as memórias salvas até agora. Normalmente desnecessário chamar no início da conversa, já que elas aparecem no seu contexto — use para conferir o estado atual depois de salvar algo novo.',
      inputSchema: z.object({}),
      execute: async () => listMemories(),
    }),

    // No `execute` on purpose — this is a client-side tool the UI must resolve by hand (renders the
    // question + option buttons, then calls `addToolOutput` with the user's pick), the same pattern
    // as the mutating tools' approval pause but returning a chosen answer instead of yes/no. See
    // ChatModal.tsx's AskQuestionCard + the `sendAutomaticallyWhen` wiring in Conversation.
    askUserQuestion: tool({
      description:
        'Faz uma pergunta ao usuário com opções pré-definidas de resposta, quando há ambiguidade real sobre como proceder (ex: qual conta usar, qual das transações parecidas ele quer dizer). A UI renderiza a pergunta com botões pra ele escolher — não invente a resposta, espere a escolha antes de continuar.',
      inputSchema: z.object({
        question: z.string().describe('A pergunta a ser exibida'),
        options: z
          .array(
            z.object({
              label: z.string().describe('Texto curto da opção'),
              description: z.string().optional().describe('Explicação opcional da opção'),
            }),
          )
          .min(2)
          .max(6)
          .describe('Entre 2 e 6 opções pré-definidas'),
        multiSelect: z.boolean().optional().default(false).describe('Se true, o usuário pode escolher mais de uma opção'),
      }),
    }),
  }
}
