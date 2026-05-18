import { useCallback, useEffect, useState } from "react";
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
    const unsubFollowing = subscribeFollowing(myUid, setFollowing);
    const unsubFollowers = subscribeFollowers(myUid, setFollowers);
    const unsubReminders = subscribeReminders(myUid, setReminders);
    return () => {
      unsubFollowing();
      unsubFollowers();
      unsubReminders();
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
