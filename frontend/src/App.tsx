import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";

function App() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
			<Card className="w-full max-w-2xl text-center shadow-lg">
				<CardContent className="flex flex-col items-center justify-center space-y-6 py-12 px-6">
					<h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
						Welcome to Your Dashboard
					</h1>
					<p className="text-lg text-muted-foreground max-w-md">
						Get started with your project. This is a clean, modern, and
						responsive dashboard template.
					</p>
					<Button className="mt-4 px-8 py-6 text-lg rounded-full font-bold shadow-md hover:shadow-xl transition-shadow duration-300">
						<a href="/api/login">Getting Started</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

export default App;
