import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const ConductorContext = createContext(null);
const STORAGE_KEY = "vsm-conductor-user";

export function ConductorProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(STORAGE_KEY) || "u-maria");
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh(uid = userId) {
    setLoading(true);
    try {
      const [u, n] = await Promise.all([api.user(uid), api.notifications(uid)]);
      setProfile(u);
      setNotifications(n.notifications || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userId);
    refresh(userId);
  }, [userId]);

  return (
    <ConductorContext.Provider
      value={{
        userId,
        setUserId,
        profile,
        notifications,
        loading,
        refresh,
      }}
    >
      {children}
    </ConductorContext.Provider>
  );
}

export function useConductor() {
  return useContext(ConductorContext);
}
