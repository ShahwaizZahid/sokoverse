import TypingEffect from "@/components/TypingEffect"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import ThemedHeroIcon from "@/components/ThemedHeroIcon"

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center">
      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center my-12 relative z-10">
        <ThemedHeroIcon />
        <h1 className="text-4xl md:text-5xl font-pixel mb-4">SOKOVERSE</h1>
        <div className="h-8 flex items-center justify-center">
          <TypingEffect
            phrases={[
              "Push. Solve. Repeat.",
              "Create. Share. Play.",
              "Think. Move. Win.",
            ]}
            typingSpeed={100}
            deletingSpeed={50}
            delayBetweenPhrases={2000}
          />
        </div>
      </div>

      {/* Start Button */}
      <div className="mt-12 relative z-10">
        <Button
          asChild
          className="font-pixel text-lg px-8 py-6 pixelated-border flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Link href="/terminal">
            START <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
