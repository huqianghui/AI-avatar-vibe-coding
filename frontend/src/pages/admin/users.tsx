import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCog,
} from "lucide-react";
import {
  Button,
  Input,
  Badge,
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers, useDeleteUser, useUpdateUser } from "@/hooks/use-users";
import { UserPersonalizationDialog } from "@/components/admin/user-personalization-dialog";
import type { AdminUser } from "@/api/users";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_VALUE = "__all__";
const PAGE_SIZE = 10;

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  user: "outline",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Skeleton loading
// ---------------------------------------------------------------------------

function UserTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="rounded-lg border bg-card">
        <div className="border-b bg-muted/50 px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b px-4 py-3">
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserManagementPage() {
  const { t } = useTranslation("admin");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState(ALL_VALUE);
  const [filterStatus, setFilterStatus] = useState(ALL_VALUE);

  // Pagination
  const [page, setPage] = useState(1);

  // Delete dialog
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminUser | null>(null);

  // Personalization dialog
  const [personalizationUser, setPersonalizationUser] = useState<AdminUser | null>(null);

  // API hooks
  const { data, isLoading } = useUsers({
    page,
    page_size: PAGE_SIZE,
    search: searchQuery || undefined,
    role: filterRole !== ALL_VALUE ? filterRole : undefined,
    is_active: filterStatus === ALL_VALUE ? undefined : filterStatus === "active",
  });

  const deleteMutation = useDeleteUser();
  const updateMutation = useUpdateUser();

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleRoleChange = (value: string) => {
    setFilterRole(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setFilterStatus(value);
    setPage(1);
  };

  const confirmDelete = () => {
    if (deleteConfirmUser) {
      deleteMutation.mutate(deleteConfirmUser.id);
    }
    setDeleteConfirmUser(null);
  };

  const toggleActive = (user: AdminUser) => {
    updateMutation.mutate({ id: user.id, data: { is_active: !user.is_active } });
  };

  if (isLoading) return <UserTableSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-foreground">
            {t("users.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("users.description")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border border-border shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("users.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterRole} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue
                  placeholder={t("users.filterRole")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {t("users.allRoles")}
                </SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue
                  placeholder={t("users.filterStatus")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {t("users.allStatuses")}
                </SelectItem>
                <SelectItem value="active">
                  {t("users.active")}
                </SelectItem>
                <SelectItem value="inactive">
                  {t("users.inactive")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("users.columnName")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("users.columnEmail")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("users.columnRole")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("users.columnBU")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t("users.columnStatus")}
                </th>
                <th className="hidden px-4 py-3 text-left text-sm font-medium text-muted-foreground lg:table-cell">
                  {t("users.columnJoinDate")}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  {t("users.columnActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {t("users.noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-b-0 transition-colors duration-150 hover:bg-muted/50"
                  >
                    {/* Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(user.full_name || user.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {user.full_name || user.username}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.email}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_BADGE_VARIANT[user.role] ?? "outline"}>
                        {user.role}
                      </Badge>
                    </td>

                    {/* BU */}
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.business_unit || "-"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block size-2.5 rounded-full ${
                            user.is_active
                              ? "bg-strength"
                              : "bg-muted-foreground"
                          }`}
                        />
                        <span className="text-sm text-foreground capitalize">
                          {user.is_active
                            ? t("users.active")
                            : t("users.inactive")}
                        </span>
                      </div>
                    </td>

                    {/* Join Date */}
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                      {formatDate(user.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="transition-colors duration-150">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleActive(user)}>
                            <Pencil className="size-4" />
                            {user.is_active
                              ? t("users.deactivate")
                              : t("users.activate")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPersonalizationUser(user)}>
                            <UserCog className="size-4" />
                            {t("personalization.title")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteConfirmUser(user)}
                          >
                            <Trash2 className="size-4" />
                            {t("users.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t("users.showing", {
                from: (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, total),
                total,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("users.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("users.next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmUser !== null}
        onOpenChange={() => setDeleteConfirmUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("users.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("users.deleteConfirm", {
                name: deleteConfirmUser?.full_name ?? deleteConfirmUser?.username ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmUser(null)}
            >
              {t("users.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("users.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personalization Dialog */}
      <UserPersonalizationDialog
        user={personalizationUser}
        open={!!personalizationUser}
        onOpenChange={(open) => !open && setPersonalizationUser(null)}
      />
    </div>
  );
}
