import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type MoveRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useGame(id: number) {
  return useQuery({
    queryKey: [api.games.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.games.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch game");
      return api.games.get.responses[200].parse(await res.json());
    },
    refetchInterval: 3000,
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ botId }: { botId: string }) => {
      const res = await fetch(api.games.create.path, {
        method: api.games.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create game");
      return api.games.create.responses[201].parse(await res.json());
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not create a new game.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.games.get.path, data.id], data);
    },
  });
}

export function useHumanMove() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ gameId, move }: { gameId: number; move: MoveRequest }) => {
      const url = buildUrl(api.games.humanMove.path, { id: gameId });
      const res = await fetch(url, {
        method: api.games.humanMove.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(move),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.games.humanMove.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to submit move");
      }
      return api.games.humanMove.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.games.get.path, data.id], data);
    },
    onError: (error) => {
      toast({
        title: "Illegal Move",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAiMove() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ gameId }: { gameId: number }) => {
      const url = buildUrl(api.games.aiMove.path, { id: gameId });
      const res = await fetch(url, {
        method: api.games.aiMove.method,
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 500) {
          try {
            const error = await res.json();
            throw new Error(error.message || "AI Failed to move");
          } catch {
            throw new Error("AI Failed to move");
          }
        }
        throw new Error("Failed to trigger AI move");
      }
      return api.games.aiMove.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.games.get.path, data.id], data);
    },
    onError: (error) => {
      toast({
        title: "AI Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useResignGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ gameId }: { gameId: number }) => {
      const url = buildUrl(api.games.resign.path, { id: gameId });
      const res = await fetch(url, {
        method: api.games.resign.method,
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to resign");
      return api.games.resign.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.games.get.path, data.id], data);
    },
  });
}

export function useResetGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ gameId }: { gameId: number }) => {
      const url = buildUrl(api.games.reset.path, { id: gameId });
      const res = await fetch(url, {
        method: api.games.reset.method,
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to reset game");
      return api.games.reset.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.games.get.path, data.id], data);
    },
  });
}
