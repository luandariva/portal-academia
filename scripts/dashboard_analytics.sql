import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* HERO */}
      <section className="px-6 py-20 text-center max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-bold mb-6"
        >
          Seu treino, sua dieta e sua academia conectados
        </motion.h1>
        <p className="text-lg md:text-xl mb-8 text-gray-600">
          O AlimentaAI é o sistema completo que aumenta o engajamento e reduz o cancelamento de alunos com app, portal e IA no WhatsApp.
        </p>
        <Button className="text-lg px-8 py-6 rounded-2xl">
          Quero implementar na minha academia
        </Button>
      </section>

      {/* PROBLEMA */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-6">
            O problema das academias hoje
          </h2>
          <p className="text-gray-600">
            Alunos desmotivados, baixa adesão à dieta, falta de acompanhamento e alto índice de cancelamento.
          </p>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-semibold text-center mb-12">
          A solução completa
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="rounded-2xl shadow">
            <CardContent className="p-6">
              <h3 className="font-semibold text-xl mb-3">App do aluno</h3>
              <p className="text-gray-600">
                Treino, dieta, evolução e gamificação em um só lugar.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow">
            <CardContent className="p-6">
              <h3 className="font-semibold text-xl mb-3">Portal da academia</h3>
              <p className="text-gray-600">
                Controle total dos alunos, engajamento e risco de cancelamento.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow">
            <CardContent className="p-6">
              <h3 className="font-semibold text-xl mb-3">IA no WhatsApp</h3>
              <p className="text-gray-600">
                Registro automático de refeições e acompanhamento em tempo real.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold mb-2">+ Engajamento</h3>
            <p className="text-gray-600">Alunos usam mais o sistema no dia a dia.</p>
          </Card>
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold mb-2">+ Retenção</h3>
            <p className="text-gray-600">Redução real de cancelamentos.</p>
          </Card>
          <Card className="p-6 rounded-2xl">
            <h3 className="font-semibold mb-2">+ Controle</h3>
            <p className="text-gray-600">Decisões baseadas em dados reais.</p>
          </Card>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 text-center px-6">
        <h2 className="text-3xl font-semibold mb-6">
          Pronto para transformar sua academia?
        </h2>
        <Button className="text-lg px-10 py-6 rounded-2xl">
          Começar agora
        </Button>
      </section>
    </div>
  );
}
