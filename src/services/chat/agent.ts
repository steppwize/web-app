import type { QueryClient } from '@tanstack/react-query'
import { ToolLoopAgent } from 'ai'
import type { AgentMemory } from '../agentMemoryService'
import type { LlmSettings } from '../llmSettingsService'
import { getChatModel } from './provider'
import { buildChatTools, buildToolApprovalConfig } from './tools'

const BASE_SYSTEM_PROMPT = `Você é o assistente financeiro do Steppwize, um app de finanças pessoais. Responda sempre em português do Brasil.

Use as tools disponíveis para consultar transações, contas, cartões, categorias e faturas antes de responder perguntas sobre os dados do usuário — nunca invente valores. Datas de transação usam o formato 'YYYY-MM-DD'.

Um mês/fatura sem lançamentos reais ainda não existe como linhas na tabela de transações — o app estima ("prevê") o que deve acontecer. Se o usuário falar em itens "fixos", "recorrentes" ou "previstos" de uma conta bancária num mês vazio/futuro, NÃO procure em listTransactions (vai voltar vazio) — use getAccountPreview, e para editar o dia/valor/categoria de um desses itens, edite o cadastro em listFixedTransactions/updateFixedTransaction/deleteFixedTransaction (o dia do mês vem da startDate). Para cartões, o equivalente é getInvoicePreview.

Tools que criam, alteram ou apagam dados exigem confirmação do usuário antes de executar — isso é automático, você só precisa chamar a tool normalmente. Cada confirmação é um esforço real pro usuário, então evite pedir várias quando uma só resolve: ao recategorizar duas ou mais transações no mesmo pedido, use updateTransactionsCategoryBulk (uma confirmação pra tudo) em vez de chamar updateTransactionCategory em loop. Sempre preencha os campos de nome/descrição dessas tools (accountName, categoryName, description) com o texto real — eles existem justamente pra a confirmação mostrar algo legível em vez de um id.

Você tem uma memória própria (tools saveMemory/listMemories) para guardar contexto que vale a pena lembrar em conversas futuras — preferências do usuário, correções recorrentes, padrões que ele já explicou antes. Salve algo novo quando perceber que seria útil não ter que perguntar de novo; não precisa confirmação do usuário pra isso.

Quando houver ambiguidade real sobre como proceder (qual conta usar, qual entre transações parecidas, etc.), use a tool askUserQuestion em vez de adivinhar ou pedir a resposta em texto livre — ela apresenta opções pré-definidas pro usuário escolher.`

function buildSystemPrompt(memories: AgentMemory[]): string {
  const today = new Date()
  const todayLabel = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const memoriesSection =
    memories.length > 0
      ? `Memórias que você salvou em conversas anteriores:\n${memories.map((m) => `- ${m.content}`).join('\n')}`
      : 'Você ainda não salvou nenhuma memória.'

  return `${BASE_SYSTEM_PROMPT}\n\nHoje é ${todayLabel} (${todayIso}).\n\n${memoriesSection}`
}

export function createChatAgent(settings: LlmSettings, queryClient: QueryClient, memories: AgentMemory[]) {
  return new ToolLoopAgent({
    model: getChatModel(settings),
    instructions: buildSystemPrompt(memories),
    tools: buildChatTools(queryClient),
    toolApproval: buildToolApprovalConfig(),
  })
}
