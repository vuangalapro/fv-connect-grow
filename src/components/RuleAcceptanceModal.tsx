import { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Shield, Info, CheckCircle, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';

interface RuleAcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onAccepted: () => void;
  skipMode?: boolean; // If true, show "Pular" button for users who already accepted
}

const INSTRUCTIONS_CONTENT = {
  title: "Instruções Importantes para Executar Tarefas",
  intro: "Bem-vindo(a) 👋\nAntes de iniciar qualquer tarefa, **leia com atenção** as instruções abaixo. Elas existem para **proteger você**, **garantir pagamentos corretos** e **evitar bloqueios injustos**.",
  sections: [
    {
      title: "1️⃣ Acesse a tarefa apenas pelo link da plataforma",
      content: "Clique **somente** no botão da tarefa dentro da plataforma\n**Nunca** abra o vídeo diretamente pelo navegador ou aplicativo\n\n⚠️ A plataforma registra automaticamente o clique como prova de execução."
    },
    {
      title: "2️⃣ Assista ao vídeo no popup até o tempo mínimo",
      content: "O vídeo abrirá em um **popup dentro da plataforma**\n**Não feche** o popup antes do tempo terminar\nAguarde o contador liberar o botão **\"Abrir no YouTube\"**\n\n⏱️ Se o tempo não for concluído, a tarefa será invalidada."
    },
    {
      title: "3️⃣ Abra o vídeo no YouTube e execute as ações",
      content: "Após o tempo mínimo:\n\n* Clique em **Abrir no YouTube**\n* Curta o vídeo 👍\n* Inscreva-se no canal 🔔 (se solicitado)\n\n📌 Essas ações devem ser **manuais e reais**."
    },
    {
      title: "4️⃣ Faça a captura de tela (screenshot)",
      content: "A captura **DEVE mostrar claramente**:\n\n* O vídeo aberto no YouTube\n* Seu canal logado (foto + nome visíveis)\n* A curtida aplicada\n\n❌ Capturas cortadas, borradas ou incompletas podem ser rejeitadas."
    },
    {
      title: "5️⃣ Envie a prova pela plataforma",
      content: "Envie **apenas uma captura por tarefa**\nAguarde a análise do administrador\nO status aparecerá como **Pendente**, **Aprovado** ou **Rejeitado**"
    }
  ]
};

const RULES_CONTENT = {
  title: "Regras da Plataforma e Sistema de Segurança",
  securityTitle: "🛡️ SISTEMA DE SEGURANÇA E ANTIFRAUDE",
  securityContent: "A plataforma utiliza **mecanismos automáticos de proteção** para garantir justiça para todos.\n\n### O que o sistema analisa:\n* IP de acesso\n* Dispositivo utilizado\n* Histórico de tarefas\n* Provas enviadas (screenshots)\n\n📌 **Nenhuma decisão é tomada automaticamente sem análise administrativa.**",
  allowedTitle: "✅ O que é PERMITIDO",
  allowedItems: [
    "Até **2 afiliados no mesmo dispositivo**",
    "IP compartilhado (dados móveis, Wi-Fi público)",
    "Executar tarefas de forma manual e honesta"
  ],
  prohibitedTitle: "❌ O que NÃO é permitido",
  prohibitedItems: [
    "Criar **várias contas para a mesma pessoa**",
    "Usar **uma única conta do YouTube para vários afiliados**",
    "Enviar screenshots reutilizados",
    "Manipular provas ou informações"
  ],
  penaltyTitle: "🧯 COMO FUNCIONAM AS PENALIDADES",
  penaltyContent: "* Cada afiliado inicia com **100% de crédito de penalidades**\n* Penalidades reduzem esse valor conforme infrações\n* Ao chegar em **0%**, a conta é **automaticamente desativada**\n\n📊 **Você pode acompanhar seu status no painel da conta.**",
  protectionTitle: "⚖️ PROTEÇÃO CONTRA BANIMENTOS INJUSTOS",
  protectionItems: [
    { allowed: false, text: "Ninguém é banido apenas por IP" },
    { allowed: false, text: "Ninguém é banido automaticamente sem análise" },
    { allowed: true, text: "O administrador vê todas as informações antes de decidir" },
    { allowed: true, text: "Casos de famílias, Wi-Fi público ou cyber cafés são analisados manualmente" }
  ],
  tipsTitle: "📢 DICAS IMPORTANTES",
  tipsItems: [
    "Use sempre o **mesmo dispositivo**",
    "Use apenas **uma conta do YouTube**",
    "Leia atentamente cada tarefa",
    "Envie provas claras e completas"
  ],
  checkboxLabel: "Li e concordo com as regras da plataforma",
  finalText: "Ao continuar usando a plataforma, você concorda com estas regras.\nElas existem para **proteger afiliados honestos** e manter a plataforma justa para todos.\n\nBom trabalho e boas tarefas 🚀"
};

export default function RuleAcceptanceModal({ isOpen, onClose, userId, onAccepted, skipMode = false }: RuleAcceptanceModalProps) {
  const [stage, setStage] = useState<1 | 2>(1);
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset stage when modal opens
  useEffect(() => {
    if (isOpen) {
      setStage(1);
      setAgreed(false);
      setError(null);
    }
  }, [isOpen]);

  const handleNext = () => {
    setStage(2);
  };

  const handleBack = () => {
    setStage(1);
  };

  const handleAccept = async () => {
    if (!userId || !agreed) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call the onAccepted callback which handles the recording in context
      await onAccepted();
      onClose();
    } catch (err: any) {
      console.error('Error recording acceptance:', err);
      setError('Erro ao registrar aceite. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Modal container */}
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Progress bar */}
        <div className="bg-gray-100 dark:bg-gray-800 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className={`font-medium ${stage === 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
              Etapa 1 de 2
            </span>
            <span className="text-gray-400">|</span>
            <span className={`font-medium ${stage === 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
              Etapa 2 de 2
            </span>
          </div>
          {/* Progress indicator */}
          <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: stage === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {/* Close button - ONLY shown after acceptance (disabled) */}
        {stage === 2 && (
          <button 
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 cursor-not-allowed"
            disabled
            title="Você deve aceitar as regras para continuar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* STAGE 1: Instructions */}
          {stage === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                  <Info className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {INSTRUCTIONS_CONTENT.title}
                </h2>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">
                  {INSTRUCTIONS_CONTENT.intro}
                </p>

                {INSTRUCTIONS_CONTENT.sections.map((section, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                      {section.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line text-sm">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 2: Rules and Penalties */}
          {stage === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 dark:bg-amber-900 rounded-full mb-4">
                  <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {RULES_CONTENT.title}
                </h2>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                
                {/* Security Section */}
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border-l-4 border-blue-500">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {RULES_CONTENT.securityTitle}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line text-sm">
                    {RULES_CONTENT.securityContent}
                  </p>
                </div>

                {/* Allowed */}
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    {RULES_CONTENT.allowedTitle}
                  </h3>
                  <ul className="space-y-2">
                    {RULES_CONTENT.allowedItems.map((item, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-300 flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="whitespace-pre-line">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Prohibited */}
                <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                  <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    {RULES_CONTENT.prohibitedTitle}
                  </h3>
                  <ul className="space-y-2">
                    {RULES_CONTENT.prohibitedItems.map((item, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-300 flex items-start gap-2 text-sm">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span className="whitespace-pre-line">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Penalties */}
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-4 border-l-4 border-amber-500">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    {RULES_CONTENT.penaltyTitle}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line text-sm">
                    {RULES_CONTENT.penaltyContent}
                  </p>
                </div>

                {/* Protection */}
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-700 dark:text-purple-400 mb-2">
                    {RULES_CONTENT.protectionTitle}
                  </h3>
                  <ul className="space-y-2">
                    {RULES_CONTENT.protectionItems.map((item, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-300 flex items-start gap-2 text-sm">
                        {item.allowed ? (
                          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        )}
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tips */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {RULES_CONTENT.tipsTitle}
                  </h3>
                  <ul className="space-y-2">
                    {RULES_CONTENT.tipsItems.map((item, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-300 flex items-start gap-2 text-sm">
                        <span className="text-blue-500">•</span>
                        <span className="whitespace-pre-line">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Final text */}
                <p className="text-center text-gray-500 dark:text-gray-400 italic text-sm">
                  {RULES_CONTENT.finalText}
                </p>

                {/* Checkbox */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="sr-only"
                      />
                      <div 
                        className={`w-6 h-6 border-2 rounded transition-colors ${
                          agreed 
                            ? 'bg-blue-600 border-blue-600' 
                            : 'border-gray-300 dark:border-gray-600 group-hover:border-blue-400'
                        }`}
                      >
                        {agreed && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                      {RULES_CONTENT.checkboxLabel}
                    </span>
                  </label>
                </div>

                {/* Error message */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between gap-3">
          
          {/* Stage 1: Next button (or Pular if skipMode) */}
          {stage === 1 && (
            <div className="flex gap-3 w-full">
              {skipMode && (
                <button
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                  Pular
                </button>
              )}
              <button
                onClick={handleNext}
                className={`flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors`}
              >
                Próximo
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Stage 2: Back and Confirm buttons */}
          {stage === 2 && (
            <>
              <button
                onClick={handleBack}
                className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-6 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </button>
              <button
                onClick={handleAccept}
                disabled={!agreed || isLoading}
                className={`flex-1 flex items-center justify-center gap-2 font-medium py-3 px-6 rounded-lg transition-colors ${
                  agreed && !isLoading
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirmar e Continuar
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
