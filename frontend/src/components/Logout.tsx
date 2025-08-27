import { Link } from "@tanstack/react-router"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Logout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-black dark:bg-black dark:text-white">
      <Card className="w-full max-w-md border-2 border-black dark:border-white shadow-none rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center space-y-6 p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Successfully Logged Out (not yet implemented so you are not logged out)
          </h1>
          <p className="text-muted-foreground text-center">
            You have been signed out of your account.
          </p>
          <Button asChild variant="outline" className="border-black dark:border-white">
            <Link to="/">Go Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
