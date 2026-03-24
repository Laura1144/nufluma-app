import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { cancelSubscription } from "@/services/subscription"

// DELETE /api/subscription — cancela a assinatura do workspace ativo
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const workspaceId = session.user.workspaceId
  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 })
  }

  // Só ADMIN pode cancelar
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem cancelar a assinatura" }, { status: 403 })
  }

  const sub = await cancelSubscription(workspaceId)
  if (!sub) {
    return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada" }, { status: 404 })
  }

  return NextResponse.json({ success: true, message: "Assinatura cancelada com sucesso" })
}
