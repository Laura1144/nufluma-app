import { NextResponse } from "next/server";

// Registro direto foi desabilitado.
// Para criar uma conta, acesse a página de checkout e realize o pagamento.
// O cadastro é realizado automaticamente após a confirmação do pagamento.
export async function POST() {
  return NextResponse.json(
    {
      error: "Cadastro direto não permitido. Acesse o checkout para criar sua conta com o plano Pro.",
      checkout_url: "https://nufluma.com/checkout.html",
    },
    { status: 403 },
  );
}
