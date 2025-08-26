import { useTheme } from "@/contexts/ThemeContext";

const ThemeToggle = () => {
	const { theme, toggleTheme } = useTheme();

	return (
		<button
			onClick={toggleTheme}
			className="bg-white dark:bg-black text-black dark:text-white"
		>
			{theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
		</button>
	);
};

export default ThemeToggle;
