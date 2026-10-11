"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorMessage } from "@/lib/apiClient";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";

const ROLES = ["super_admin", "seller", "seller_cashier", "rider", "customer"];
const PAGE_SIZE = 20;

// Admin list of all users with a role filter, search and enable/disable.
export default function UsersTable() {
  const t = useTranslations();
  const [role, setRole] = useState("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ users: [], total: 0 });
  const [error, setError] = useState(null);
  const [busyUserId, setBusyUserId] = useState(null);
  // Bumped to make the list load again after a change.
  const [reloadCount, setReloadCount] = useState(0);

  // Loads one page of users whenever the filters, page or reloadCount change.
  useEffect(() => {
    let isCancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (role) params.set("role", role);
    if (search) params.set("search", search);

    api(`/admin/users?${params}`)
      .then((data) => {
        if (isCancelled) return;
        setResult(data);
        setError(null);
      })
      .catch((loadError) => {
        if (!isCancelled) setError(loadError);
      });

    return () => {
      isCancelled = true;
    };
  }, [page, role, search, reloadCount]);

  // Enables or disables one user, then reloads the list.
  async function toggleActive(user) {
    setBusyUserId(user.id);
    try {
      await api(`/admin/users/${user.id}/status`, { method: "PATCH", body: { isActive: !user.isActive } });
      setReloadCount((count) => count + 1);
    } catch (toggleError) {
      setError(toggleError);
    } finally {
      setBusyUserId(null);
    }
  }

  // Applies the search box when the form is submitted.
  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchText.trim());
  }

  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const canChange = (user) => user.role !== "super_admin" && user.role !== "seller_cashier";

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">{t("admin.users")}</h2>

      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <select
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value);
          }}
          className="min-h-11 rounded-md border border-line bg-surface px-2 text-ink"
          aria-label={t("admin.colRole")}
        >
          <option value="">{t("admin.allRoles")}</option>
          {ROLES.map((roleName) => (
            <option key={roleName} value={roleName}>
              {t(`roles.${roleName}`)}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t("admin.searchPlaceholder")}
          className="min-h-11 flex-1 rounded-md border border-line bg-surface px-3 text-ink"
        />
        <Button type="submit" variant="secondary">
          {t("common.search")}
        </Button>
      </form>

      {error && <Alert type="error">{errorMessage(error, t)}</Alert>}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">{t("admin.colName")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.colEmail")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.colRole")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.colStatus")}</th>
              <th className="px-3 py-2 font-medium">{t("admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {result.users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-subtle">
                  {t("admin.noUsers")}
                </td>
              </tr>
            )}
            {result.users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{user.name}</td>
                <td className="px-3 py-2 text-ink">{user.email}</td>
                <td className="px-3 py-2 text-ink">{t(`roles.${user.role}`)}</td>
                <td className={`px-3 py-2 ${user.isActive ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
                  {user.isActive ? t("admin.active") : t("admin.disabled")}
                </td>
                <td className="px-3 py-2">
                  {canChange(user) && (
                    <Button
                      variant={user.isActive ? "danger" : "secondary"}
                      className="min-h-9 px-3"
                      isBusy={busyUserId === user.id}
                      onClick={() => toggleActive(user)}
                    >
                      {user.isActive ? t("admin.disable") : t("admin.enable")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-subtle">
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t("common.previous")}
        </Button>
        <span>{t("admin.pageInfo", { page, pages: pageCount })}</span>
        <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
          {t("common.next")}
        </Button>
      </div>
    </section>
  );
}
