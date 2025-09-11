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
					<div className="px-2 font-bold">
						<Link to="/dashboard">Dashboard</Link>
					</div>
					<div className="px-2 font-bold">
						<Link to="/handles">Handles</Link>
					</div>
					<div className="px-2 font-bold">
						<a href="/api/login">Login</a>
					</div>
					<div className="px-2 font-bold">
						<Link to="/logout">Logout</Link>
					</div>

					<ThemeToggle />
				</nav>
			</header>
			{children}
		</div>
	);
}
