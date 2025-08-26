import { Link } from "@tanstack/react-router";
import ThemeToggle from "./ThemeToggle.tsx";
import type { ReactNode } from "react";

export default function Header({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col grow h-screen min-h-screen max-h-screen">
			<header className="p-2 flex dark:text-white gap-2 bg-white dark:bg-black text-black justify-between">
				<nav className="flex flex-row gap-2">
					<div className="px-2 font-bold">
						<Link to="/">Home</Link>
					</div>

					<ThemeToggle />
				</nav>
			</header>
      {children}
		</div>
	);
}
