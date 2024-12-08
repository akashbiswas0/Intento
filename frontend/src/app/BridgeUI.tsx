'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useAccount } from 'wagmi'
// import { useNetwork } from '@wagmi/core'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ArrowRightIcon, LoaderIcon, MoonIcon, SunIcon } from 'lucide-react'
import BRIDGE_ABI from '@/lib/intentAVSAbi.json'
// WETH ABI for approval
const WETH_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
]

const WETH_ADDRESS = "0x94373a4919b3240d86ea41593d5eba789fef3848"
const BRIDGE_INTENT_AVS_ADDRESS = "0x1b116da635a722d9e7f9bcf48ab65b80fe98aee4" // Replace with your bridge contract address


export default function BridgeUI() {
  const { address, isConnected } = useAccount()
  // const { chain } = useNetwork()
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [transactions, setTransactions] = useState([
    { id: 1, status: 'completed', from: 'ETH', to: 'MATIC', amount: '0.5' },
    { id: 2, status: 'pending', from: 'USDC', to: 'USDT', amount: '100' },
  ])
  const [amount, setAmount] = useState("")
  const [allowance, setAllowance] = useState("0")
  const [isApproving, setIsApproving] = useState(false)
  const [isBridging, setIsBridging] = useState(false)

  useEffect(() => {
    checkAllowance()
  }, [address, amount])

  const checkAllowance = async () => {
    if (!address || !window.ethereum) return
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, provider)
      const currentAllowance = await wethContract.allowance(address, BRIDGE_INTENT_AVS_ADDRESS)
      setAllowance(currentAllowance.toString())
    } catch (error) {
      console.error("Error checking allowance:", error)
    }
  }

  const handleApprove = async () => {
    if (!address || !window.ethereum) return
    
    try {
      setIsApproving(true)
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer)
      
      const tx = await wethContract.approve(
        BRIDGE_INTENT_AVS_ADDRESS,
        ethers.utils.parseEther(amount) // Approve only the input amount
      )
      await tx.wait()
      await checkAllowance()
    } catch (error) {
      console.error("Error approving:", error)
    } finally {
      setIsApproving(false)
    }
  }

  const handleBridge = async () => {
    if (!amount || !isConnected || !window.ethereum) return
    
    try {
      setIsBridging(true)
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const signer = provider.getSigner()
      const bridgeContract = new ethers.Contract(BRIDGE_INTENT_AVS_ADDRESS, BRIDGE_ABI, signer)

      const sourceAmount = ethers.utils.parseEther(amount)
      const fillerFee = sourceAmount.mul(1).div(1000) // 0.1% fee
      const destAmount = sourceAmount.sub(fillerFee)

      const tx = await bridgeContract.createIntent(
        WETH_ADDRESS, // sourceToken
        sourceAmount, // sourceAmount
        84532, // destinationChainId
        "0x4200000000000000000000000000000000000006", // destinationToken
        destAmount, // destinationAmount
        fillerFee // fillerFee
      )
      
      await tx.wait()
      setTransactions([
        { id: transactions.length + 1, status: 'pending', from: 'ETH', to: 'MATIC', amount },
        ...transactions
      ])
    } catch (error) {
      console.error("Error bridging:", error)
    } finally {
      setIsBridging(false)
    }
  }

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value)
  }

  const needsApproval = ethers.utils.parseEther(amount || "0").gt(allowance)

  // Calculate destination amount and relay fee
  const sourceAmount = ethers.utils.parseEther(amount || "0")
  const fillerFee = sourceAmount.mul(1).div(1000) // 0.1% fee
  const destAmount = sourceAmount.sub(fillerFee)

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="dark:bg-background bg-background min-h-screen text-foreground transition-colors duration-300">
        {/* Navbar */}
        <nav className="flex justify-between items-center p-4 bg-card shadow-sm">
          <h1 className="text-2xl font-bold text-primary">Intento-AVS</h1>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={toggleTheme}
            >
              {isDarkMode ? <SunIcon className="h-[1.2rem] w-[1.2rem]" /> : <MoonIcon className="h-[1.2rem] w-[1.2rem]" />}
            </Button>
            <ConnectButton 
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </nav>

        {/* Bridge Component */}
        <div className="container mx-auto mt-8 p-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-center text-primary">Bridge Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-sm font-medium">From</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Ethereum Holesky</SelectItem>
                      {/* <SelectItem value="polygon">Polygon</SelectItem> */}
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eth">WETH</SelectItem>
                      {/* <SelectItem value="usdc">USDC</SelectItem> */}
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    placeholder="Amount" 
                    value={amount}
                    onChange={handleAmountChange}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-sm font-medium">To</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Base Sepolia</SelectItem>
                      {/* <SelectItem value="polygon">Polygon</SelectItem> */}
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eth">WETH</SelectItem>
                      {/* <SelectItem value="usdc">USDC</SelectItem> */}
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    placeholder="You receive" 
                    value={ethers.utils.formatEther(destAmount)} // Display destination amount
                    disabled 
                  />
                </div>
              </div>
              <div className="flex justify-center items-center my-4">
                <div className="bg-primary p-2 rounded-full">
                  <ArrowRightIcon className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Relay Fee</span>
                  <span className="font-medium">{ethers.utils.formatEther(fillerFee)} (0.1%)</span> {/* Display relay fee */}
                </div>
                <div className="flex justify-between text-sm">
                  <span>You Receive</span>
                  <span className="font-medium">{ethers.utils.formatEther(destAmount)}</span> {/* Display destination amount */}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={needsApproval ? handleApprove : handleBridge}
                disabled={!isConnected || !amount || isApproving || isBridging}
              >
                {isApproving ? (
                  <>
                    <LoaderIcon className="animate-spin" />
                    Approving...
                  </>
                ) : isBridging ? (
                  <>
                    <LoaderIcon className="animate-spin" />
                    Bridging...
                  </>
                ) : needsApproval ? (
                  'Approve WETH'
                ) : (
                  'Bridge'
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Transaction Status Section */}
          {/* <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-primary">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center p-4 bg-muted rounded-lg transition-all duration-300 hover:shadow-md">
                    <div>
                      <p className="font-medium">{tx.from} → {tx.to}</p>
                      <p className="text-sm text-muted-foreground">Amount: {tx.amount}</p>
                    </div>
                    <div className="flex items-center">
                      {tx.status === 'pending' ? (
                        <LoaderIcon className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                      )}
                      <span className="ml-2 text-sm">{tx.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card> */}
        </div>
      </div>
    </div>
  )
}