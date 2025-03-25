import { createPublicClient, http } from "viem"
import { sepolia } from "viem/chains"

export const client = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
}) 