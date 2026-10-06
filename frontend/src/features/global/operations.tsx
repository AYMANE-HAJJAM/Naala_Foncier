"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  getGetUsersQueryKey,
  useActivateUser,
  useCreateUser,
  useDeactivateUser,
  useGetRoles,
  useGetUsers,
  useUpdateUser,
} from "@/generated/api/naala";
import type { UserItem } from "@/types/domain";
import { PageHeader } from "@/components/shared/page";
import { Card, Dialog, StatusBadge } from "@/components/ui/core";
import { Button } from "@/components/ui/button";
import { uiErrorMessage } from "@/lib/api/error-message";

type RoleOption = { id: string; key: string; name: string };

export function UsersPage() {
  const { data } = useGetUsers();
  const users = (data?.data ?? []) as unknown as UserItem[];
  const queryClient = useQueryClient();
  const activate = useActivateUser();
  const deactivate = useDeactivateUser();
  const create = useCreateUser();
  const update = useUpdateUser();
  const rolesQuery = useGetRoles();
  const roles = (rolesQuery.data?.data ?? []) as unknown as RoleOption[];
  const [createOpen, setCreateOpen] = useState(false);

  const refreshUsers = () =>
    queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });

  const setActive = async (user: UserItem) => {
    try {
      if (user.status === "Actif") {
        await deactivate.mutateAsync({ id: user.id });
        toast.success("Utilisateur désactivé");
      } else {
        await activate.mutateAsync({ id: user.id });
        toast.success("Utilisateur réactivé");
      }
      await refreshUsers();
    } catch (error) {
      toast.error(uiErrorMessage(error, "Impossible de modifier le statut de l’utilisateur"));
    }
  };

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérant / Administrateur et Utilisateur — accès contrôlé par assignation de terrains."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Créer un utilisateur
          </Button>
        }
      />
      <Card className="nf-table-wrap overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-[var(--surface-muted)] text-[12px] font-medium text-[var(--text-muted)]">
              <tr>
                {[
                  "Nom",
                  "Email",
                  "Rôle",
                  "Statut",
                  "Terrains attribués",
                  "Dernière connexion",
                  "Actions",
                ].map((heading) => (
                  <th className="px-4 py-2.5 font-medium" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isAdminRole = /admin|gérant|gerant|administrateur/i.test(
                  user.role,
                );
                return (
                  <tr
                    key={user.id}
                    className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-9 place-items-center rounded-full bg-[var(--navy-900)] text-[10px] font-semibold text-white shadow-[var(--shadow-xs)]">
                          {user.initials}
                        </span>
                        <span className="font-semibold">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="nf-input min-w-40"
                        value={user.roleKey ?? (isAdminRole ? "ADMIN" : "USER")}
                        onChange={async (event) => {
                          const role = roles.find(
                            (item) => item.key === event.target.value,
                          );
                          if (!role) return;
                          try {
                            await update.mutateAsync({
                              id: user.id,
                              data: { roleIds: [role.id] },
                            });
                            await refreshUsers();
                            toast.success("Rôle mis à jour");
                          } catch (error) {
                            toast.error(uiErrorMessage(error, "Impossible de modifier le rôle"));
                          }
                        }}
                      >
                        <option value="ADMIN">Gérant / Administrateur</option>
                        <option value="USER">Utilisateur</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">—</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">—</td>
                    <td className="px-4 py-3">
                      <Button
                        onClick={() => void setActive(user)}
                        variant="ghost"
                        size="sm"
                        disabled={activate.isPending || deactivate.isPending}
                      >
                        {user.status === "Actif" ? "Désactiver" : "Réactiver"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-[var(--text-muted)]"
                  >
                    Aucun utilisateur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <UserCreateDialog
        open={createOpen}
        close={() => setCreateOpen(false)}
        roles={roles}
        busy={create.isPending}
        submit={async (body) => {
          try {
            await create.mutateAsync({ data: body });
            await refreshUsers();
            setCreateOpen(false);
            toast.success("Utilisateur créé");
          } catch (error) {
            toast.error(uiErrorMessage(error, "Création impossible"));
          }
        }}
      />
    </>
  );
}

type UserCreateDialogProps = {
  open: boolean;
  close: () => void;
  roles: RoleOption[];
  busy: boolean;
  submit: (body: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleIds: string[];
  }) => Promise<void>;
};

function UserCreateDialog({
  open,
  close,
  roles,
  busy,
  submit,
}: UserCreateDialogProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleKey: "USER",
  });
  const fields = [
    ["firstName", "Prénom", "text"],
    ["lastName", "Nom", "text"],
    ["email", "Email", "email"],
    ["password", "Mot de passe temporaire", "password"],
  ] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && close()}
      title="Créer un utilisateur"
      description="Le mot de passe temporaire est communiqué directement à l’utilisateur."
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const role = roles.find((item) => item.key === form.roleKey);
          if (role)
            void submit({
              firstName: form.firstName,
              lastName: form.lastName,
              email: form.email,
              password: form.password,
              roleIds: [role.id],
            });
        }}
      >
        {fields.map(([key, label, type]) => (
          <label key={key} className="text-xs font-medium">
            {label}
            <input
              required
              minLength={key === "password" ? 8 : undefined}
              type={type}
              className="nf-input mt-1"
              value={form[key]}
              onChange={(event) =>
                setForm({ ...form, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <label className="text-xs font-medium">
          Rôle
          <select
            className="nf-input mt-1"
            value={form.roleKey}
            onChange={(event) =>
              setForm({ ...form, roleKey: event.target.value })
            }
          >
            <option value="USER">Utilisateur</option>
            <option value="ADMIN">Gérant / Administrateur</option>
          </select>
        </label>
        <Button disabled={busy || roles.length === 0} type="submit">
          Créer
        </Button>
      </form>
    </Dialog>
  );
}
