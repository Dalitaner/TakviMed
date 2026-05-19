import { useCallback, useEffect, useState } from "react";
import { auth } from "../services/firebase";
import {
  dismissReminder as dismissReminderRequest,
  followFamilyByCode,
  removeFollower as removeFollowerRequest,
  sendReminderToMember,
  subscribeFollowers,
  subscribeFollowing,
  subscribeMemberMedications,
  subscribeMemberTakenLogs,
  subscribeReminders,
  unfollowFamilyMember,
} from "../services/familyService";

export function useFamily({ myUid, myName }) {
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    if (!myUid) {
      setFollowing([]);
      setFollowers([]);
      setReminders([]);
      return undefined;
    }
    let cancelled = false;
    let cleanups = [];
    (async () => {
      if (typeof auth.authStateReady === "function") {
        try { await auth.authStateReady(); } catch { /* ignore */ }
      }
      if (cancelled || auth.currentUser?.uid !== myUid) return;
      cleanups = [
        subscribeFollowing(myUid, setFollowing),
        subscribeFollowers(myUid, setFollowers),
        subscribeReminders(myUid, setReminders),
      ];
    })();
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn && fn());
    };
  }, [myUid]);

  const follow = useCallback(
    (code) => followFamilyByCode({ myUid, myName, code }),
    [myUid, myName],
  );

  const unfollow = useCallback(
    (theirUid) => unfollowFamilyMember({ myUid, theirUid }),
    [myUid],
  );

  const removeFollower = useCallback(
    (followerUid) => removeFollowerRequest({ myUid, followerUid }),
    [myUid],
  );

  const sendReminder = useCallback(
    ({ targetUid, message }) => sendReminderToMember({ targetUid, fromUid: myUid, fromName: myName, message }),
    [myUid, myName],
  );

  const dismissReminder = useCallback(
    (reminderId) => dismissReminderRequest({ myUid, reminderId }),
    [myUid],
  );

  return {
    following,
    followers,
    reminders,
    follow,
    unfollow,
    removeFollower,
    sendReminder,
    dismissReminder,
  };
}

export function useFollowedMemberData(memberUid) {
  const [medications, setMedications] = useState([]);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    if (!memberUid) {
      setMedications([]);
      setChecked({});
      return undefined;
    }
    const unsubMeds = subscribeMemberMedications(memberUid, setMedications);
    const unsubLogs = subscribeMemberTakenLogs(memberUid, setChecked);
    return () => {
      unsubMeds();
      unsubLogs();
    };
  }, [memberUid]);

  return { medications, checked };
}
