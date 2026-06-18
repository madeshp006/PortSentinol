import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, RefreshCw, Users, Shield, UserCheck, UserX, Trash2, Edit2, UserPlus, ShieldCheck, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as api from "../utils/api";

export function UserManagementScreen() {
  const navigate = useNavigate();
  const { token, profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
    isActive: true,
  });

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getAdminUsers(token);
      setUsers(data);
    } catch (e: any) {
      setError(e.message || "Failed to load users listing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && profile.role !== "SUPER_ADMIN") {
      navigate("/app");
      return;
    }
    loadUsers();
  }, [token, profile]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSuccessMsg("");

    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setError("Please fill out all fields.");
      return;
    }

    try {
      await api.createAdminUser(token, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      });
      setSuccessMsg("Account created successfully!");
      setShowCreateModal(false);
      setFormData({ name: "", email: "", password: "", role: "USER", isActive: true });
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user account");
    }
  };

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "", // Leave blank unless updating
      role: user.role,
      isActive: user.isActive,
    });
    setShowEditModal(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedUser) return;
    setError("");
    setSuccessMsg("");

    try {
      await api.updateAdminUser(token, selectedUser.id, {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        isActive: formData.isActive,
        password: formData.password.trim() || undefined,
      });
      setSuccessMsg("Account updated successfully!");
      setShowEditModal(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to update user account");
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.id === profile?.id) {
      setError("You cannot delete your own admin account.");
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete the account for ${user.name}?`)) {
      return;
    }

    setError("");
    setSuccessMsg("");
    try {
      await api.deleteAdminUser(token!, user.id);
      setSuccessMsg("Account deleted successfully!");
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to delete user account");
    }
  };

  const handleToggleStatus = async (user: any) => {
    if (user.id === profile?.id) {
      setError("You cannot disable your own admin account.");
      return;
    }
    setError("");
    setSuccessMsg("");

    try {
      const updatedStatus = !user.isActive;
      await api.updateAdminUser(token!, user.id, {
        isActive: updatedStatus,
      });
      setSuccessMsg(`Account ${updatedStatus ? "activated" : "disabled"} successfully!`);
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to toggle account status");
    }
  };

  // Filtered list
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && user.isActive) ||
      (statusFilter === "INACTIVE" && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Role style mapping
  const getRoleBadgeStyle = (role: string) => {
    if (role === "SUPER_ADMIN") return { bg: "rgba(239,68,68,0.1)", text: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" };
    if (role === "SECURITY_ANALYST") return { bg: "rgba(167,139,250,0.1)", text: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" };
    return { bg: "rgba(56,189,248,0.1)", text: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" };
  };

  // Stats counters
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const analystCount = users.filter((u) => u.role === "SECURITY_ANALYST").length;
  const adminCount = users.filter((u) => u.role === "SUPER_ADMIN").length;

  return (
    <div className="pb-8 px-4 md:px-6" style={{ minHeight: "850px", fontFamily: "Inter" }}>
      {/* Header */}
      <div className="pt-4 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c3254]/40 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/app/admin")} className="flex items-center justify-center rounded-xl bg-slate-900 border border-[#1c3254]/80 p-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#e8f0fe]">User Access Gating</h2>
            <p className="text-xs text-[#4a6080]">Manage user logins, roles, and status</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadUsers} className="flex items-center justify-center rounded-xl bg-slate-900 border border-[#1c3254]/80 p-2 text-sky-400 hover:text-sky-300">
            <motion.div animate={loading ? { rotate: 360 } : { rotate: 0 }} transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
              <RefreshCw size={16} />
            </motion.div>
          </button>
          <button
            onClick={() => {
              setFormData({ name: "", email: "", password: "", role: "USER", isActive: true });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-sky-500/10 transition-all"
          >
            <UserPlus size={14} /> Add Account
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}
      {successMsg && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">{successMsg}</div>}

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Registered", value: totalCount, icon: Users, color: "#38bdf8" },
          { label: "Active Logins", value: activeCount, icon: UserCheck, color: "#22c55e" },
          { label: "Security Analysts", value: analystCount, icon: Shield, color: "#a78bfa" },
          { label: "System Admins", value: adminCount, icon: ShieldCheck, color: "#ef4444" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl p-4 bg-slate-900/60 border border-[#1c3254]/40">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={18} style={{ color: stat.color }} />
              <span className="text-xl font-extrabold text-white">{stat.value}</span>
            </div>
            <p className="text-[10px] uppercase font-bold tracking-wide text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters Control Panel */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-[#1c3254]/30 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 relative">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl bg-[#030812] border border-[#1c3254]/60 px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl bg-[#030812] border border-[#1c3254]/60 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Roles</option>
            <option value="USER">User</option>
            <option value="SECURITY_ANALYST">Security Analyst</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-[#030812] border border-[#1c3254]/60 px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* User Listing Table */}
      <div className="rounded-xl bg-slate-900/60 border border-[#1c3254]/40 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-900 border-b border-[#1c3254]/40 text-slate-500 font-bold text-xs uppercase tracking-wide">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c3254]/30 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 font-medium">
                    Loading directory, please wait...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 font-medium">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const badge = getRoleBadgeStyle(user.role);
                  const isSelf = user.id === profile?.id;
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1c3254] to-[#070d1e] border border-[#1c3254] flex items-center justify-center text-xs font-bold text-sky-400 uppercase">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-200 flex items-center gap-1.5">
                              {user.name}
                              {isSelf && <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded-full font-normal">You</span>}
                            </div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                          style={{ backgroundColor: badge.bg, color: badge.text, border: badge.border }}
                        >
                          {user.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${user.isActive ? "text-emerald-400" : "text-rose-400"}`}>
                          {user.isActive ? <UserCheck size={12} /> : <UserX size={12} />}
                          {user.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={isSelf}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isSelf
                                ? "opacity-35 cursor-not-allowed border-slate-800 text-slate-600"
                                : user.isActive
                                ? "border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/20"
                                : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                            title={user.isActive ? "Disable login access" : "Restore login access"}
                          >
                            {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded-lg border border-sky-500/20 bg-sky-500/5 text-sky-400 hover:bg-sky-500/20 transition-colors"
                            title="Edit details"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isSelf}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isSelf
                                ? "opacity-35 cursor-not-allowed border-slate-800 text-slate-600"
                                : "border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/20"
                            }`}
                            title="Delete Account"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-[#1c3254] rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c3254]/40 bg-[#070d1e]">
                <h3 className="font-bold text-slate-200">Register New Account</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                    placeholder="name@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Default Password (min. 8 chars)</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Assigned Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="USER">Standard User</option>
                    <option value="SECURITY_ANALYST">Security Analyst</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-4 pt-4 border-t border-[#1c3254]/40">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 text-xs font-bold border border-slate-700 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-xs font-bold bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-xl hover:from-sky-400 hover:to-indigo-400 transition-all shadow-md shadow-sky-500/10"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-[#1c3254] rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c3254]/40 bg-[#070d1e]">
                <h3 className="font-bold text-slate-200">Modify Account Settings</h3>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleEditUser} className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Change Password (leave blank to keep)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                    placeholder="New password (min. 8 chars)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Assigned Role</label>
                  <select
                    value={formData.role}
                    disabled={selectedUser.id === profile?.id}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full rounded-xl bg-[#030812] border border-[#1c3254] px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500 disabled:opacity-40"
                  >
                    <option value="USER">Standard User</option>
                    <option value="SECURITY_ANALYST">Security Analyst</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    disabled={selectedUser.id === profile?.id}
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-[#1c3254] text-sky-500 focus:ring-sky-500 bg-[#030812]"
                  />
                  <label htmlFor="isActiveCheck" className="text-xs font-bold text-slate-300 cursor-pointer select-none">
                    Account is active and allowed to log in
                  </label>
                </div>
                <div className="flex gap-3 mt-4 pt-4 border-t border-[#1c3254]/40">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-3 text-xs font-bold border border-slate-700 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 text-xs font-bold bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-xl hover:from-sky-400 hover:to-indigo-400 transition-all shadow-md shadow-sky-500/10"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
