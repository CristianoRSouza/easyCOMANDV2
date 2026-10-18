"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@/shared/http/server-fn";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { StoreCombobox } from "@/modules/pix/ui/store-combobox";
import type { StoreLite } from "@/modules/pix/infrastructure/use-stores";
import {
  managePixCredentials,
  type PixCredentialStatus,
} from "@/modules/pix/infrastructure/credentials.functions";
import {
  PIX_DEFAULT_API_BASE_URL,
  PIX_ENVIRONMENTS,
  type PixEnvironment,
} from "@/modules/pix/infrastructure/client";

export function PixCredentialsDialog({
  open,
  onOpenChange,
  stores,
  credentials,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stores: StoreLite[];
  credentials: PixCredentialStatus[];
  prefill: { store_id: string; environment: PixEnvironment } | null;
  onSaved: () => void;
}) {
  const save = useServerFn(managePixCredentials);
  const [storeId, setStoreId] = useState("");
  const [environment, setEnvironment] = useState<PixEnvironment>("producao");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [basicUser, setBasicUser] = useState("");
  const [basicToken, setBasicToken] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [insecureTls, setInsecureTls] = useState(false);

  const storeList = useMemo(
    () => [...stores].sort((a, b) => a.name.localeCompare(b.name)),
    [stores],
  );

  const existing = credentials.find(
    (c) => c.store_id === storeId && c.environment === environment,
  );

  useEffect(() => {
    if (!open) return;
    if (prefill) {
      setStoreId(prefill.store_id);
      setEnvironment(prefill.environment);
    }
  }, [open, prefill]);

  useEffect(() => {
    setApiBaseUrl(existing?.api_base_url ?? PIX_DEFAULT_API_BASE_URL[environment]);
    setBasicUser(existing?.basic_user ?? "");
    setBasicToken("");
    setSecretKey("");
    setEnabled(existing?.enabled ?? true);
    setInsecureTls(existing?.insecure_tls ?? false);
    // Recarrega os campos ao trocar de loja/ambiente.
  }, [storeId, environment, existing?.id]);

  const store = storeList.find((s) => s.id === storeId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!store) throw new Error("Selecione a loja.");
      return save({
        data: {
          action: "save" as const,
          store_id: store.id,
          company_id: store.company_id,
          environment,
          api_base_url: apiBaseUrl,
          basic_user: basicUser,
          ...(basicToken ? { basic_token: basicToken } : {}),
          ...(secretKey ? { secret_key: secretKey } : {}),
          enabled,
          insecure_tls: insecureTls,
        },
      });
    },
    onSuccess: () => {
      toast.success("Credenciais salvas.");
      setBasicToken("");
      setSecretKey("");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Credenciais PIXnoPDV</DialogTitle>
          <DialogDescription>
            Dados de acesso da loja na PIXnoPDV. Sem eles a emissão de URL falha. Os valores
            secretos não são exibidos depois de salvos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Loja</label>
            <StoreCombobox stores={storeList} value={storeId} onChange={setStoreId} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ambiente</label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as PixEnvironment)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIX_ENVIRONMENTS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {storeId && (
            <p className="text-xs text-muted-foreground">
              {existing
                ? `Já existe cadastro ${existing.enabled ? "habilitado" : "desabilitado"} · token ${existing.basic_token_masked ?? "faltando"} · chave secreta ${existing.secret_key_masked ?? "faltando"}.`
                : "Nenhuma credencial cadastrada para esta loja neste ambiente."}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                URL base da API
              </label>
              <Input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder={PIX_DEFAULT_API_BASE_URL[environment]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Usuário (basic)</label>
              <Input value={basicUser} onChange={(e) => setBasicUser(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Basic token {existing?.has_basic_token ? "(deixe vazio para manter)" : ""}
              </label>
              <Input
                type="password"
                value={basicToken}
                onChange={(e) => setBasicToken(e.target.value)}
                placeholder={existing?.basic_token_masked ?? ""}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Secret key {existing?.has_secret_key ? "(deixe vazio para manter)" : ""}
              </label>
              <Input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={existing?.secret_key_masked ?? ""}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              Habilitada
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={insecureTls} onCheckedChange={setInsecureTls} />
              Ignorar validação TLS
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!storeId || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar credenciais
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
