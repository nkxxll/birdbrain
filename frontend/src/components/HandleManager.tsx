import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchTwitterHandles,
	createTwitterHandle,
	updateTwitterHandle,
	deleteTwitterHandle,
} from "@/lib/api";
import type { UserHandle } from "@/lib/models";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { toast } from "react-hot-toast";

type DisplayHandle = UserHandle & { isPrepopulated: boolean };

const PREPOPULATED_HANDLES: { username: string; handle: string }[] = [
	{ username: "sama", handle: "@sama" },
	{ username: "gdb", handle: "@gdb" },
	{ username: "demishassabis", handle: "@demishassabis" },
	{ username: "AndrewYNg", handle: "@AndrewYNg" },
	{ username: "ronald_van_loon", handle: "@ronald_van_loon" },
	{ username: "alliekmiller", handle: "@alliekmiller" },
	{ username: "TheNextWeb", handle: "@TheNextWeb" },
	{ username: "recode", handle: "@recode" },
	{ username: "ZDNet", handle: "@ZDNet" },
	{ username: "TechCrunch", handle: "@TechCrunch" },
	{ username: "WIRED", handle: "@WIRED" },
	{ username: "verge", handle: "@verge" },
	{ username: "mashable", handle: "@mashable" },
	{ username: "Gizmodo", handle: "@Gizmodo" },
	{ username: "CNET", handle: "@CNET" },
	{ username: "engadget", handle: "@engadget" },
	{ username: "arstechnica", handle: "@arstechnica" },
	{ username: "TechRepublic", handle: "@TechRepublic" },
	{ username: "briansolis", handle: "@briansolis" },
	{ username: "williamtincup", handle: "@williamtincup" },
	{ username: "Josh_Bersin", handle: "@Josh_Bersin" },
	{ username: "Codie_Sanchez", handle: "@Codie_Sanchez" },
	{ username: "awilkinson", handle: "@awilkinson" },
	{ username: "GaryVee", handle: "@GaryVee" },
	{ username: "jaltucher", handle: "@jaltucher" },
	{ username: "dave_morin", handle: "@dave_morin" },
	{ username: "seanpk", handle: "@seanpk" },
	{ username: "matt_gray_", handle: "@matt_gray_" },
	{ username: "Codie_Sanchez", handle: "@Codie_Sanchez" },
	{ username: "awilkinson", handle: "@awilkinson" },
	{ username: "elonmusk", handle: "@elonmusk" },
	{ username: "MSFT365Status", handle: "@MSFT365Status" },
	{ username: "TechCrunch", handle: "@TechCrunch" },
	{ username: "WIRED", handle: "@WIRED" },
	{ username: "verge", handle: "@verge" },
	{ username: "mashable", handle: "@mashable" },
	{ username: "Gizmodo", handle: "@Gizmodo" },
	{ username: "CNET", handle: "@CNET" },
	{ username: "engadget", handle: "@engadget" },
	{ username: "arstechnica", handle: "@arstechnica" },
	{ username: "TechRepublic", handle: "@TechRepublic" },
	{ username: "briansolis", handle: "@briansolis" },
	{ username: "williamtincup", handle: "@williamtincup" },
	{ username: "Josh_Bersin", handle: "@Josh_Bersin" },
	{ username: "Codie_Sanchez", handle: "@Codie_Sanchez" },
	{ username: "awilkinson", handle: "@awilkinson" },
	{ username: "GaryVee", handle: "@GaryVee" },
	{ username: "jaltucher", handle: "@jaltucher" },
	{ username: "dave_morin", handle: "@dave_morin" },
	{ username: "seanpk", handle: "@seanpk" },
	{ username: "matt_gray_", handle: "@matt_gray_" },
	{ username: "Codie_Sanchez", handle: "@Codie_Sanchez" },
	{ username: "awilkinson", handle: "@awilkinson" },
	{ username: "elonmusk", handle: "@elonmusk" },
	{ username: "MSFT365Status", handle: "@MSFT365Status" },
];

export default function HandleManager() {
	const queryClient = useQueryClient();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [newHandle, setNewHandle] = useState<Partial<UserHandle>>({
		username: "",
		handle: "",
	});
	const [editedHandle, setEditedHandle] = useState<DisplayHandle | null>(null);

	const { data: handles, isLoading } = useQuery<UserHandle[]>({
		queryKey: ["twitter_handles"],
		queryFn: fetchTwitterHandles,
	});

	const dbHandles: DisplayHandle[] =
		handles?.map((h) => ({ ...h, isPrepopulated: false })) || [];
	const mergedHandles: DisplayHandle[] = dbHandles.slice();
	for (const prep of PREPOPULATED_HANDLES) {
		if (!dbHandles.find((h) => h.handle === prep.handle)) {
			mergedHandles.push({ ...prep, isPrepopulated: true });
		}
	}

	const createMutation = useMutation({
		mutationFn: createTwitterHandle,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["twitter_handles"] });
			setNewHandle({ username: "", handle: "" });
			toast.success("Handle created!");
		},
		onError: () => {
			toast.error("Failed to create handle.");
		},
	});

	const updateMutation = useMutation({
		mutationFn: updateTwitterHandle,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["twitter_handles"] });
			setEditingId(null);
			setEditedHandle(null);
			toast.success("Handle updated!");
		},
		onError: () => {
			toast.error("Failed to update handle.");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteTwitterHandle,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["twitter_handles"] });
			toast.success("Handle deleted!");
		},
		onError: () => {
			toast.error("Failed to delete handle.");
		},
	});

	const handleEditClick = (handle: DisplayHandle) => {
		setEditingId(handle.handle);
		setEditedHandle({ ...handle, isPrepopulated: handle.isPrepopulated });
	};

	const handleSaveClick = () => {
		if (editedHandle) {
			if (editedHandle.isPrepopulated) {
				createMutation.mutate(editedHandle);
			} else {
				updateMutation.mutate(editedHandle);
			}
		}
	};

	const handleCancelClick = () => {
		setEditingId(null);
		setEditedHandle(null);
	};

	if (isLoading) return <div>Loading...</div>;

	return (
		<div className="p-4">
			<Card>
				<CardHeader>
					<CardTitle>Manage Twitter Handles</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{mergedHandles.map((handle) => (
							<div key={handle.handle} className="flex items-center gap-2">
								{editingId === handle.handle ? (
									<>
										<Input
											value={editedHandle?.username || ""}
											onChange={(e) =>
												setEditedHandle((h) =>
													h ? { ...h, username: e.target.value } : null,
												)
											}
											placeholder="Username"
										/>
										<Input
											value={editedHandle?.handle || ""}
											onChange={(e) =>
												setEditedHandle((h) =>
													h ? { ...h, handle: e.target.value } : null,
												)
											}
											placeholder="@handle"
										/>
										<Button onClick={handleSaveClick}>Save</Button>
										<Button onClick={handleCancelClick} variant="outline">
											Cancel
										</Button>
									</>
								) : (
									<div
										className={
											"w-full flex" +
											(handle.isPrepopulated ? " bg-secondary" : "")
										}
									>
										<div className="grow">
											{handle.username} ({handle.handle})
										</div>
										<div>
											<Button
												onClick={() => handleEditClick(handle)}
												variant="default"
											>
												Edit
											</Button>
											<Button
												onClick={() => deleteMutation.mutate(handle.id!)}
												variant="destructive"
											>
												Delete
											</Button>
										</div>
									</div>
								)}
							</div>
						))}
					</div>
					<div className="fixed left-5 bottom-5 m-4 p-4 border rounded-xl bg-background">
						<h3 className="font-bold">Add New Handle</h3>
						<div className="flex items-center gap-2 mt-2">
							<Input
								value={newHandle.username}
								onChange={(e) =>
									setNewHandle({ ...newHandle, username: e.target.value })
								}
								placeholder="Username"
							/>
							<Input
								value={newHandle.handle}
								onChange={(e) =>
									setNewHandle({ ...newHandle, handle: e.target.value })
								}
								placeholder="@handle"
							/>
							<Button onClick={() => createMutation.mutate(newHandle)}>
								Add
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
