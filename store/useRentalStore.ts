
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  PropertyType, 
  Property, 
  PropertyRecord, 
  RecordValue, 
  Payment,
  UnitHistory,
  AppConfig,
  UserRole,
  Expense,
  AppNotification,
  PushSubscriptionData,
  NotificationType
} from '../types';
import { 
  auth, 
  db, 
  handleFirestoreError,
  OperationType 
} from '../lib/firebase';
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  updatePassword,
  setPersistence,
  inMemoryPersistence,
  getAuth,
  updateProfile,
  signOut, 
  onAuthStateChanged,
  deleteUser as deleteFirebaseUser,
  User as FirebaseUser 
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  where,
  deleteDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

const RentalContext = createContext<any>(null);

export const RentalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);

  // Firestore Data State
  const [users, setUsers] = useState<User[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [records, setRecords] = useState<PropertyRecord[]>([]);
  const [recordValues, setRecordValues] = useState<RecordValue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [unitHistory, setUnitHistory] = useState<UnitHistory[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    paidToOptions: ['Company Account', 'Bank Account', 'Petty Cash', 'Owner Direct'],
    paymentModeOptions: ['Bank Transfer', 'Cash', 'Check', 'UPI/QR', 'Credit Card'],
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston']
  });

  const SUPERADMIN_EMAIL = 'manashparashar9926@gmail.com';

  const isSuperAdmin = (emailOrUsername?: string) => {
    return emailOrUsername?.toLowerCase().trim() === SUPERADMIN_EMAIL;
  };

  const [isManagedUser, setIsManagedUser] = useState(() => {
    return localStorage.getItem('isManagedUser') === 'true';
  });

    // Auth Listener
    useEffect(() => {
    let unsubUser: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      if (fUser) {
        setIsManagedUser(false);
        localStorage.removeItem('isManagedUser');
        localStorage.removeItem('managedUserId');
        
        const email = fUser.email?.toLowerCase().trim() || '';
        const isBootstrapAdmin = isSuperAdmin(email);
        
        // Use username to find doc if email matches username field
        const userDocRef = doc(db, 'users', email);

        // Real-time listener for current user profile
        unsubUser = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const userData = { ...data as User, id: fUser.uid }; // Ensure ID matches Auth UID
            
            // Sync UID if needed in Firestore doc for consistency if they differ
            if (data.id !== fUser.uid) {
              await updateDoc(userDocRef, { id: fUser.uid }).catch(e => console.warn("Failed to sync UID:", e));
            }
            setUser(userData);
          } else if (isBootstrapAdmin) {
            // Create bootstrap admin if it doesn't exist
            const adminUser: User = {
              id: fUser.uid,
              username: email,
              name: fUser.displayName || 'Super Admin',
              role: UserRole.ADMIN,
              passwordHash: '',
              createdAt: new Date().toISOString(),
              assignedPropertyIds: []
            };
            await setDoc(userDocRef, adminUser);
            setUser(adminUser);
          } else {
            // Non-admin, check for pre-authorized migration
            try {
              const userQuery = query(collection(db, 'users'), where('username', '==', email));
              const querySnapshot = await getDocs(userQuery);
              if (!querySnapshot.empty) {
                const preAuthItem = querySnapshot.docs[0];
                const preAuthData = preAuthItem.data() as User;
                const linkedUser: User = { ...preAuthData, id: fUser.uid };
                
                // Move data to the email-keyed document if it was keyed differently or just update
                await setDoc(userDocRef, linkedUser);
                setUser(linkedUser);
              } else {
                setUser(null);
              }
            } catch (migrationErr) {
              handleFirestoreError(migrationErr, OperationType.LIST, 'users', true);
              setUser(null);
            }
          }
          setIsBooting(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'users_snapshot', true);
          setIsBooting(false);
        });
      } else {
        const savedUserId = localStorage.getItem('managedUserId');
        const isManaged = localStorage.getItem('isManagedUser') === 'true';

        if (isManaged && savedUserId) {
          getDoc(doc(db, 'users', savedUserId)).then(snap => {
            if (snap.exists()) setUser(snap.data() as User);
            else {
               setUser(null);
               localStorage.removeItem('isManagedUser');
               localStorage.removeItem('managedUserId');
            }
            setIsBooting(false);
          }).catch(() => {
            setUser(null);
            setIsBooting(false);
          });
        } else {
          setUser(null);
          setIsBooting(false);
        }
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, [isManagedUser]);

  // Real-time Data Listeners
  useEffect(() => {
    if (!user || (!firebaseUser && !isManagedUser)) {
      setUsers([]);
      setPropertyTypes([]);
      setProperties([]);
      setRecords([]);
      setRecordValues([]);
      setPayments([]);
      setExpenses([]);
      setUnitHistory([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    const setupListener = (collectionName: string, setter: (data: any) => void, customQuery?: any) => {
      if (!firebaseUser) {
        if (isManagedUser) {
          const fetch = () => {
            getDocs(customQuery || collection(db, collectionName)).then(snapshot => {
              setter(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
            }).catch(err => {
              console.warn(`[Managed User] Fetch failed for ${collectionName}:`, err.message);
            });
          };
          fetch();
          const interval = setInterval(fetch, 15000); // Increased polling interval slightly
          const unsub = () => clearInterval(interval);
          unsubscribes.push(unsub);
        }
        return;
      }
      
      const target = customQuery || collection(db, collectionName);
      const unsub = onSnapshot(target, (snapshot) => {
        setter(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      }, (error) => {
        if (error.message.toLowerCase().includes('permission')) {
          console.warn(`[Auth User] Snapshot Permission Denied for ${collectionName}. Query may need more restrictive filters.`, error.message);
          setter([]);
        } else {
          handleFirestoreError(error, OperationType.LIST, collectionName, true);
        }
      });
      unsubscribes.push(unsub);
    };

    // 1. Initial Listeners (Always present or Role-based)
    setupListener('propertyTypes', setPropertyTypes);
    setupListener('config', (data) => { if(data.length > 0) setConfig(data.find((d: any) => d.id === 'global') || config); });
    
    const actualRole = user.role;
    const isGlobalAdmin = actualRole === UserRole.ADMIN || 
                          actualRole === UserRole.MANAGER || 
                          isSuperAdmin(user.username);

    if (isGlobalAdmin) {
      setupListener('users', setUsers);
      setupListener('properties', setProperties);
      setupListener('expenses', setExpenses);
      setupListener('notifications', setNotifications);
      setupListener('records', setRecords);
      setupListener('recordValues', setRecordValues);
      setupListener('payments', setPayments);
      setupListener('unitHistory', setUnitHistory);
    } else {
      // Non-Admin Restricted Listeners
      const lowerUsername = user.username?.toLowerCase().trim() || '';
      const userId = user.id || '';
      const actualUserRole = user.role;
      
      const fetchRestrictedProperties = () => {
        // Now that rules are broader for Managers, we can use a global fetch 
        // to avoid missing properties due to complex array-contains queries.
        const unsub = onSnapshot(collection(db, 'properties'), (snapshot) => {
          setProperties(snapshot.docs.map(doc => ({ ...doc.data() as Property, id: doc.id })));
        }, (err) => {
          console.warn("Restricted property fetch limited by permissions:", err.message);
          setProperties([]);
        });
        unsubscribes.push(unsub);
      };
      
      fetchRestrictedProperties();

      // For Managers/Admins, we should be able to see all user names for assignment
      if (actualUserRole === UserRole.MANAGER) {
        setupListener('users', setUsers);
      } else {
        const uIds = [userId, user.username, lowerUsername].filter(Boolean);
        setupListener('users', setUsers, query(collection(db, 'users'), where('username', 'in', uIds)));
      }

      // Expenses created by me
      const myExpensesQuery = query(collection(db, 'expenses'), where('createdBy', '==', user.id));
      setupListener('expenses', setExpenses, myExpensesQuery);

      // Notifications sent to me
      const myNotifsQuery = query(collection(db, 'notifications'), where('userId', '==', lowerUsername));
      setupListener('notifications', setNotifications, myNotifsQuery);
    }

    const configUnsub = onSnapshot(doc(db, 'config', 'global'), (snapshot) => {
      if (snapshot.exists()) setConfig(snapshot.data() as AppConfig);
    }, (error) => console.warn("Global config access limited"));
    unsubscribes.push(configUnsub);

    return () => unsubscribes.forEach(u => u());
  }, [user?.id, user?.role, firebaseUser?.uid, user?.assignedPropertyIds?.join(',')]);

  // Second effect to handle dependent listeners for non-admins (records, payments, etc.)
  useEffect(() => {
    const isGlobalAdmin = user?.role === UserRole.ADMIN || 
                          user?.role === UserRole.MANAGER || 
                          (user?.username && isSuperAdmin(user.username));
    
    if (!user || isGlobalAdmin) {
      return;
    }
    
    if (properties.length === 0) {
      setRecords([]);
      setRecordValues([]);
      setPayments([]);
      setUnitHistory([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    
    const isManager = user.role === UserRole.MANAGER;
    
    const effectiveAssignedIds = properties.filter(p => {
      if (isManager) return true;
      const lowerUsername = user.username?.toLowerCase().trim() || '';
      const userId = user.id || '';
      const allowed = (p.allowedUserIds || []).map(id => id.toLowerCase());
      return user.assignedPropertyIds?.includes(p.id) || 
             allowed.includes(userId.toLowerCase()) || 
             allowed.includes(lowerUsername);
    }).map(p => p.id);

    if (effectiveAssignedIds.length === 0 && !isManager) {
      setRecords([]);
      setRecordValues([]);
      setPayments([]);
      setUnitHistory([]);
      return;
    }

    const assignedIds = isManager ? properties.map(p => p.id) : effectiveAssignedIds;
    
    const setupDependentListener = (col: string, setter: (updateFn: (prev: any[]) => any[]) => void) => {
      // Split into chunks if > 30 (Firestore limit)
      for (let i = 0; i < assignedIds.length; i += 30) {
        const chunk = assignedIds.slice(i, i + 30);
        const q = query(collection(db, col), where('propertyId', 'in', chunk));
        
        const unsub = onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          setter(prev => {
            const others = prev.filter((p: any) => !chunk.includes(p.propertyId));
            return [...others, ...items];
          });
        }, (error) => {
           if (error.message.toLowerCase().includes('permission')) {
             console.warn(`[Snapshot Permission] Dependency list for ${col} restricted:`, error.message);
             setter(prev => prev.filter((p: any) => !chunk.includes(p.propertyId)));
           } else {
             handleFirestoreError(error, OperationType.LIST, col, true);
           }
        });
        unsubscribes.push(unsub);
      }
    };

    setupDependentListener('records', setRecords);
    setupDependentListener('recordValues', setRecordValues);
    setupDependentListener('payments', setPayments);
    setupDependentListener('unitHistory', setUnitHistory);

    // Also handle expenses for assigned properties (in addition to 'my' expenses)
    for (let i = 0; i < assignedIds.length; i += 30) {
      const chunk = assignedIds.slice(i, i + 30);
      const q = query(collection(db, 'expenses'), where('propertyId', 'in', chunk));
      const unsub = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setExpenses(prev => {
          const others = prev.filter((e: any) => !chunk.includes(e.propertyId) && e.createdBy !== user.id);
          return [...others, ...items];
        });
      }, (error) => {
        console.warn(`[Snapshot Permission] Expense dependency fetch restricted:`, error.message);
      });
      unsubscribes.push(unsub);
    }

    return () => unsubscribes.forEach(u => u());
  }, [user?.id, properties.map(p => p.id).sort().join(',')]); 


  const login = async (email: string, pass: string) => {
    setIsSyncing(true);
    const emailId = email.toLowerCase().trim();
    const password = pass.trim();
    let authErrorToPreserve: any = null;
    
    try {
        // 1. Try Firebase Auth (Standard)
        try {
          await signInWithEmailAndPassword(auth, emailId, password);
          
          // Post-authentication ledger verification
          const userDoc = await getDocFromServer(doc(db, 'users', emailId));
          if (userDoc.exists()) {
            const ud = userDoc.data() as User;
            if (ud.passwordHash && ud.passwordHash !== password) {
              await signOut(auth);
              console.warn("Access blocked: Auth success with old password, but ledger required new password.");
              const authBlockError = new Error("Security Alert: Your password has been updated in the management console. Please use the NEW credentials to sign in.");
              (authBlockError as any).code = 'auth/ledger-mismatch';
              throw authBlockError;
            }
          }
          
          return true;
        } catch (authError: any) {
          authErrorToPreserve = authError;
          
          // High-priority auth errors that should NOT be swallowed but can still be checked against ledger
          console.warn("Auth attempt failed, will check ledger fallback:", authError.code);
          
          if (authError.code === 'auth/ledger-mismatch') {
            throw authError; // Already signed out and has descriptive message
          }
          
          if (authError.code === 'auth/operation-not-allowed') {
            throw new Error("Password Sign-In is disabled in your project settings. Please use Google 'Quick Sign In' instead.");
          }
          
          const credentialErrors = [
            'auth/user-not-found',
            'auth/invalid-credential', 
            'auth/wrong-password',
            'auth/internal-error',
            'auth/invalid-email',
            'auth/network-request-failed',
            'auth/too-many-requests'
          ];
          
          if (!credentialErrors.includes(authError.code)) {
            throw authError;
          }
        }

      // 2. Try Managed Fallback (Check Firestore ledger for discrepancies)
      let userData: User | null = null;
      
      try {
        let userDocRef = doc(db, 'users', emailId);
        let snapshot = await getDocFromServer(userDocRef);
        
        if (snapshot.exists()) {
          userData = snapshot.data() as User;
        } else {
          // Perform a constrained query
          const q = query(collection(db, 'users'), where('username', '==', emailId));
          const qSnap = await getDocsFromServer(q);
          if (!qSnap.empty) {
            userData = qSnap.docs[0].data() as User;
          }
        }
      } catch (permissionError) {
        console.warn("Permission denied checking user ledger:", permissionError);
      }

      if (userData) {
        const hasManagedPassword = Boolean(userData.passwordHash && userData.passwordHash.length > 0);
        
        if (hasManagedPassword) {
          if (userData.passwordHash === password) {
            // User used the NEW password! Auth fails but Ledger matches.
            console.info("Managed login activated for out-of-sync Auth record.");
            setIsManagedUser(true);
            localStorage.setItem('isManagedUser', 'true');
            localStorage.setItem('managedUserId', userData.username);
            setUser(userData);
            return true;
          }
        }
      }

      if (authErrorToPreserve) {
        const code = authErrorToPreserve.code;
        if (code === 'auth/too-many-requests') {
           throw new Error("Security Lockdown: Too many failed login attempts. Please wait 5-10 minutes or use Google 'Quick Sign In' for instant access.");
        }
        
        // If we found a user in the ledger but Auth failed and Ledger password didn't match
        if (userData) {
           const hasManagedPassword = Boolean(userData.passwordHash && userData.passwordHash.length > 0);
           if (!hasManagedPassword) {
             throw new Error("This account is authorized but has no direct password configured. Please use the Google 'Quick Sign In' button to access the console.");
           } else {
             throw new Error("Invalid password. If you recently updated your password in the Team tab, ensure you are using the NEW one.");
           }
        }

        if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) {
          throw new Error("Invalid email or password. Please verify your credentials or use Google 'Quick Sign In' if you previously used that method.");
        }
        throw authErrorToPreserve;
      }

      if (userData) {
        // No managed password found but user doc exists
        throw new Error("This account is authorized but has no direct password configured. Please use the Google 'Quick Sign In' button to access the console.");
      }
      
      throw new Error("Account not found. Please contact your property administrator to authorize your email.");
    } catch (error: any) {
      console.error("Login Error:", error.message);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const loginWithGoogle = async () => {
    setIsSyncing(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      return true;
    } catch (error: any) {
      console.error("Google login failed:", error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setIsManagedUser(false);
    localStorage.removeItem('isManagedUser');
    localStorage.removeItem('managedUserId');
  };

  const addUser = async (u: User) => {
    setIsSyncing(true);
    try {
      const emailId = u.username.toLowerCase().trim();
      
      // Always store in Firestore under the email document ID
      if (u.passwordHash) {
        const secondaryAppName = `TempUser_Add_${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          // CRITICAL: Prevent session leakage by using in-memory persistence for secondary app
          await setPersistence(secondaryAuth, inMemoryPersistence);
          
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailId, u.passwordHash);
          const newUser: User = {
            ...u,
            id: userCredential.user.uid,
            username: emailId,
            assignedPropertyIds: [], // RESET assigned properties on re-add/re-creation
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', emailId), newUser);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            await setDoc(doc(db, 'users', emailId), {
              ...u,
              id: emailId,
              username: emailId,
              assignedPropertyIds: [], // RESET assigned properties on re-add
              createdAt: new Date().toISOString()
            });
          } else {
            throw authErr;
          }
        } finally {
          await deleteApp(secondaryApp);
        }
      } else {
        await setDoc(doc(db, 'users', emailId), {
          ...u,
          id: emailId,
          username: emailId,
          assignedPropertyIds: [], // RESET assigned properties on re-add
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteUser = async (id: string) => {
    setIsSyncing(true);
    try {
      // 1. Fetch user doc first to check if they have a managed password
      const userDoc = await getDoc(doc(db, 'users', id));
      const userData = userDoc.data() as User | undefined;

      if (userData && userData.passwordHash) {
        console.log(`Attempting automatic Auth cleanup for managed user: ${id}...`);
        const secondaryAppName = `TempUser_Del_${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          await setPersistence(secondaryAuth, inMemoryPersistence);
          // Sign in as the user to delete them 
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, id, userData.passwordHash);
          await deleteFirebaseUser(userCredential.user);
          console.log(`✅ Authentication account for ${id} deleted automatically.`);
        } catch (authErr: any) {
          console.warn(`⚠️ Auth cleanup skipped for ${id}: ${authErr.message}. Manual deletion in Firebase Console may still be required if they have a Google account.`);
        } finally {
          await deleteApp(secondaryApp);
        }
      } else {
        console.info(`ℹ️ User ${id} uses external Auth (Google). Please delete manually from Firebase Console (Auth tab) to revoke full access.`);
      }

      // 2. Delete from Firestore ledger
      await deleteDoc(doc(db, 'users', id));
      console.log(`User ${id} removed from system ledger.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    setIsSyncing(true);
    try {
      await updateDoc(doc(db, 'users', id), updates);
      
      // If password was updated in ledger, we SHOULD inform admin it doesn't sync automatically 
      // UNLESS we try a best-effort sync if they provided an OLD password? 
      // But admin doesn't have old password.
      // However, we can try to "Reset" it if we have a secondary auth app and the user is managed.
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const addPropertyType = async (t: PropertyType) => {
    try {
      await setDoc(doc(db, 'propertyTypes', t.id), t);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'propertyTypes');
    }
  };

  const updatePropertyType = async (t: PropertyType) => {
    try {
      await updateDoc(doc(db, 'propertyTypes', t.id), { ...t });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `propertyTypes/${t.id}`);
    }
  };

  const deletePropertyType = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'propertyTypes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `propertyTypes/${id}`);
    }
  };

  const addProperty = async (p: Property) => {
    try {
      await setDoc(doc(db, 'properties', p.id), { ...p, isVisibleToManager: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'properties');
    }
  };

  const updateProperty = async (id: string, u: Partial<Property>) => {
    try {
      await updateDoc(doc(db, 'properties', id), u);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `properties/${id}`);
    }
  };

  const deleteProperty = async (id: string) => {
    setIsSyncing(true);
    try {
      const mgr = createBatchManager();

      // 1. Delete property itself
      mgr.delete(doc(db, 'properties', id));

      // 2. Delete related expenses
      console.log(`Purging expenses for property ${id}...`);
      const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('propertyId', '==', id)));
      for (const eDoc of expensesSnapshot.docs) {
        mgr.delete(doc(db, 'expenses', eDoc.id));
        await mgr.checkCommit();
      }

      // 3. Find and Delete ALL records associated with this property
      console.log(`Purging all records and sub-data for property ${id}...`);
      const recordsSnapshot = await getDocs(query(collection(db, 'records'), where('propertyId', '==', id)));
      
      for (const rDoc of recordsSnapshot.docs) {
        const rId = rDoc.id;
        await purgeRecordData(rId, mgr);
        mgr.delete(doc(db, 'records', rId));
        await mgr.checkCommit();
      }

      // 4. Delete notifications by propertyId directly
      const propNotifsSnapshot = await getDocs(query(collection(db, 'notifications'), where('propertyId', '==', id)));
      for (const nDoc of propNotifsSnapshot.docs) {
        mgr.delete(doc(db, 'notifications', nDoc.id));
        await mgr.checkCommit();
      }

      // 5. Update assignedPropertyIds for users
      const assignedUsers = users.filter(u => u.assignedPropertyIds?.includes(id));
      for (const u of assignedUsers) {
        const newAssigned = u.assignedPropertyIds?.filter(pid => pid !== id) || [];
        mgr.update(doc(db, 'users', u.username), { assignedPropertyIds: newAssigned });
        await mgr.checkCommit();
      }

      await mgr.commit();
      console.log(`Property ${id} purged successfully.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `properties/${id}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const createBatchManager = () => {
    let batch = writeBatch(db);
    let count = 0;
    return {
      delete(ref: any) {
        batch.delete(ref);
        count++;
      },
      update(ref: any, data: any) {
        batch.update(ref, data);
        count++;
      },
      async commit() {
        if (count > 0) {
          await batch.commit();
          count = 0;
          batch = writeBatch(db);
        }
      },
      async checkCommit() {
        if (count >= 480) {
          await this.commit();
        }
      }
    };
  };

  const purgeRecordData = async (recordId: string, mgr?: any) => {
    const internalMgr = mgr || createBatchManager();
    const isExternal = !mgr;

    const collections = ['recordValues', 'unitHistory', 'payments', 'notifications'];
    for (const coll of collections) {
      const q = query(collection(db, coll), where('recordId', '==', recordId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        internalMgr.delete(doc(db, coll, d.id));
        await internalMgr.checkCommit();
      }
    }

    if (isExternal) {
      await internalMgr.commit();
    }
  };

  const deleteRecord = async (id: string) => {
    setIsSyncing(true);
    try {
      await purgeRecordData(id);
      await deleteDoc(doc(db, 'records', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `records/${id}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const addRecord = async (r: PropertyRecord, v: RecordValue[]) => {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'records', r.id), r);
      v.forEach(val => {
        batch.set(doc(db, 'recordValues', val.id), {
          id: val.id,
          recordId: val.recordId,
          propertyId: r.propertyId,
          columnId: val.columnId,
          value: val.value
        });
      });
      const now = new Date().toISOString();
      const historyId = 'h' + Date.now();
      const mapped = v.reduce((acc, x) => ({...acc, [x.columnId]: x.value}), {});
      batch.set(doc(db, 'unitHistory', historyId), {
        id: historyId,
        recordId: r.id,
        propertyId: r.propertyId,
        values: mapped,
        effectiveFrom: now,
        effectiveTo: null
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'records');
    }
  };

  const updateRecord = async (recordId: string, values: RecordValue[], effectiveDate?: string) => {
    try {
      const propertyId = records.find(r => r.id === recordId)?.propertyId;
      if (!propertyId) throw new Error("Property Context Missing");

      const batch = writeBatch(db);
      const effDate = effectiveDate ? new Date(effectiveDate).toISOString() : new Date().toISOString();
      const mappedNewValues = values.reduce((acc, v) => ({...acc, [v.columnId]: v.value}), {});
      
      const activeHist = unitHistory.find(h => h.recordId === recordId && h.effectiveTo === null);
      if (activeHist) {
        const closeOutTime = new Date(new Date(effDate).getTime() - 1000).toISOString();
        batch.update(doc(db, 'unitHistory', activeHist.id), { effectiveTo: closeOutTime });
      }

      const historyId = 'h' + Date.now();
      batch.set(doc(db, 'unitHistory', historyId), {
        id: historyId,
        recordId,
        propertyId,
        values: mappedNewValues,
        effectiveFrom: effDate,
        effectiveTo: null
      });

      const oldVals = recordValues.filter(v => v.recordId === recordId);
      oldVals.forEach(v => batch.delete(doc(db, 'recordValues', v.id)));
      values.forEach(v => {
        // Explicitly pick allowed fields to prevent strict schema failures
        const payload = {
          id: v.id,
          recordId: v.recordId,
          propertyId: propertyId,
          columnId: v.columnId,
          value: v.value
        };
        batch.set(doc(db, 'recordValues', v.id), payload);
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'unitHistory');
    }
  };

  const updateRecordNotes = async (id: string, notes: string) => {
    try {
      await updateDoc(doc(db, 'records', id), { notes });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `records/${id}`);
    }
  };

  const clean = (obj: any) => {
    const cleaned: any = {};
    Object.entries(obj).forEach(([key, val]) => {
      if (val !== undefined) cleaned[key] = val;
    });
    return cleaned;
  };

  const togglePayment = async (rId: string, m: string, a: number, d: string, x: Partial<Payment> = {}, t: any = 'RENT') => {
    try {
      const propertyId = records.find(r => r.id === rId)?.propertyId;
      if (!propertyId) throw new Error("Property Context Missing");

      const match = (p: Payment) => 
        p.recordId === rId && 
        p.month === m && 
        p.type === t && 
        (!x.historyId || p.historyId === x.historyId);
        
      const matches = payments.filter(match);
      
      if (matches.length > 0) {
        // Delete all matching payments (Revert)
        const batch = writeBatch(db);
        matches.forEach(p => {
          batch.delete(doc(db, 'payments', p.id));
        });
        await batch.commit();
      } else if (a > 0) {
        // Only add if amount > 0
        const payId = 'pay' + Date.now();
        const payload = clean({
          id: payId,
          recordId: rId,
          propertyId,
          month: m,
          amount: a,
          status: x.status || 'PAID',
          type: t,
          dueDate: d,
          paidAt: new Date().toISOString(),
          createdBy: user?.name || user?.username || 'System',
          createdByRole: user?.role || UserRole.ADMIN,
          ...x
        });
        await setDoc(doc(db, 'payments', payId), payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
    }
  };

  const addPayment = async (p: Partial<Payment>) => {
    setIsSyncing(true);
    try {
      const propertyId = p.propertyId || records.find(r => r.id === p.recordId)?.propertyId;
      if (!propertyId) throw new Error("Property Context Missing");

      const payId = 'pay' + Date.now();
      const newPayment = clean({
        id: payId,
        paidAt: new Date().toISOString(),
        status: 'PAID',
        propertyId,
        createdBy: user?.name || user?.username || 'System',
        createdByRole: user?.role || UserRole.ADMIN,
        ...p
      });
      await setDoc(doc(db, 'payments', payId), newPayment);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
    } finally {
      setIsSyncing(false);
    }
  };

  const deletePayment = async (id: string) => {
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, 'payments', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `payments/${id}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateConfig = async (u: Partial<AppConfig>) => {
    try {
      await setDoc(doc(db, 'config', 'global'), clean({ ...config, ...u }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/global');
    }
  };

  const addExpense = async (e: Partial<Expense>) => {
    setIsSyncing(true);
    try {
      const expenseId = 'exp' + Date.now();
      const newExpense = clean({
        id: expenseId,
        createdAt: new Date().toISOString(),
        createdBy: user?.id || 'unknown',
        createdByRole: user?.role || UserRole.VIEWER,
        ...e
      });
      await setDoc(doc(db, 'expenses', expenseId), newExpense);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteExpense = async (id: string) => {
    console.log(`[Store] Attempting to delete expense: ${id}`);
    if (!id) {
      console.warn("[Store] deleteExpense called with null/undefined ID");
      return;
    }
    setIsSyncing(true);
    try {
      await deleteDoc(doc(db, 'expenses', id));
      console.log(`[Store] Successfully deleted expense: ${id}`);
    } catch (error) {
      console.error(`[Store] Error deleting expense ${id}:`, error);
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const deleteAllNotifications = async () => {
    setIsSyncing(true);
    try {
      if (!user) return;
      const lowerUsername = user.username?.toLowerCase().trim() || '';
      const q = query(collection(db, 'notifications'), where('userId', 'in', [user.username, lowerUsername].filter(Boolean)));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(docSnap => {
        batch.delete(doc(db, 'notifications', docSnap.id));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notifications/all');
    } finally {
      setIsSyncing(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        await subscribeToPushNotifications();
      } catch (e) {
        console.error("Failed to subscribe to push notifications", e);
      }
    }
    return permission === 'granted';
  };

  const subscribeToPushNotifications = async () => {
    const swRegistration = await navigator.serviceWorker.register('/sw.js');
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    
    if (!vapidKey) {
      console.warn("VITE_VAPID_PUBLIC_KEY not found in environment variables.");
      return;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    // Store subscription in Firestore for backend usage
    if (user && firebaseUser) {
      const subId = `sub_${user.username.replace(/[@.]/g, '_')}`;
      await setDoc(doc(db, 'pushSubscriptions', subId), {
        id: subId,
        userId: user.username,
        subscription: JSON.stringify(subscription),
        createdAt: new Date().toISOString()
      }).catch(e => handleFirestoreError(e, OperationType.WRITE, `pushSubscriptions/${subId}`, true));
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // OVERDUE RENT AUTOMATION (Simulation of background check)
  useEffect(() => {
    if (!user || !firebaseUser || user.role === UserRole.VIEWER || isBooting) return;
    
    const checkOverdue = async () => {
      // Small defensive check for firebaseUser again inside the async task
      if (!auth.currentUser) return;
      const today = new Date();
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      const overdueToDetect: any[] = [];

      for (const record of records) {
        // Find property
        const property = properties.find(p => p.id === record.propertyId);
        if (!property) continue;

        // Check authorization: Admin sees all, Manager/Viewer only if allowedUserIds includes them
        const isAuthorizedAtProperty = (property.allowedUserIds || []).includes(user.id) || 
                                       (property.allowedUserIds || []).includes(user.username);

        if (user.role !== UserRole.ADMIN && !isAuthorizedAtProperty) continue;

        const propertyType = propertyTypes.find(pt => pt.id === property.propertyTypeId);
        if (!propertyType) continue;

        const rentDueDay = propertyType.defaultDueDateDay || 5;
        const dueDate = new Date(today.getFullYear(), today.getMonth(), rentDueDay);

        // Check if today is past due date
        if (today > dueDate) {
          // Check if RENT payment exists
          const activeHist = unitHistory.find(h => h.recordId === record.id && h.effectiveTo === null);
          const isPaid = payments.some(p => 
            p.recordId === record.id && 
            p.month === currentMonthKey && 
            p.type === 'RENT' && 
            p.status === 'PAID' &&
            (!activeHist || p.historyId === activeHist.id)
          );
          
          if (!isPaid) {
            // Check if notification already exists
            const existingNotif = notifications.find(n => n.recordId === record.id && n.month === currentMonthKey && n.type === 'RENT_OVERDUE');
            
            if (!existingNotif) {
              // Collect details for new notification
              const activeVals = activeHist ? activeHist.values : recordValues.filter(v => v.recordId === record.id).reduce((acc: any, v) => ({...acc, [v.columnId]: v.value}), {});
              
              const unitName = Object.entries(activeVals).find(([colId, _]) => {
                const col = propertyType.columns.find(c => c.id === colId);
                return col?.name.toLowerCase().includes('unit') || col?.name.toLowerCase().includes('name');
              })?.[1] || 'Unknown Unit';

              const rentVal = Object.entries(activeVals).find(([colId, _]) => {
                const col = propertyType.columns.find(c => c.id === colId);
                return col?.isRentCalculatable;
              })?.[1] || '0';

              overdueToDetect.push({
                recordId: record.id,
                propertyId: property.id,
                propertyName: property.name,
                unitName,
                amount: rentVal,
                month: currentMonthKey
              });
            }
          }
        }
      }

      if (overdueToDetect.length > 0) {
        const batch = writeBatch(db);
        const now = new Date().toISOString();

        for (const item of overdueToDetect) {
          const notifId = `notif_overdue_${item.recordId}_${item.month}`;
          const adminNotif: AppNotification = {
            id: notifId,
            userId: SUPERADMIN_EMAIL,
            title: 'Rent Overdue Alert',
            message: `Rent for ${item.unitName} (${item.propertyName}) is overdue. Amount: ₹${item.amount}.`,
            type: 'RENT_OVERDUE',
            propertyId: item.propertyId,
            recordId: item.recordId,
            month: item.month,
            createdAt: now,
            isRead: false
          };
          batch.set(doc(db, 'notifications', notifId), adminNotif);

          // If there's an assigned manager, notify them too
          // Identify all users (Managers and Admins) who should be notified for this property
          const propDetail = properties.find(p => p.id === item.propertyId);
          const propertyAllowedIds = (propDetail?.allowedUserIds || []).map(id => id.toLowerCase().trim());
          const relevantUsers = users.filter(u => {
            const uUsername = u.username?.toLowerCase().trim();
            if (!uUsername) return false;
            if (uUsername === SUPERADMIN_EMAIL.toLowerCase()) return false; // Handled separately
            
            const isManagerOrAdmin = u.role === UserRole.MANAGER || u.role === UserRole.ADMIN;
            if (!isManagerOrAdmin) return false;

            const uId = u.id?.toLowerCase().trim();
            
            return (u.assignedPropertyIds || []).includes(item.propertyId) || 
                   propertyAllowedIds.includes(uUsername) || 
                   (uId && propertyAllowedIds.includes(uId));
          });

          relevantUsers.forEach(m => {
            const mNotifId = `notif_overdue_${item.recordId}_${item.month}_${m.username.replace(/[@.]/g, '_')}`;
            batch.set(doc(db, 'notifications', mNotifId), {
              ...adminNotif,
              id: mNotifId,
              userId: m.username
            });
          });

          // Show native browser notification if granted
          if (Notification.permission === 'granted') {
             new Notification('Rent Overdue Alert', {
               body: `Rent for ${item.unitName} (${item.propertyName}) is overdue.`,
               icon: '/favicon.ico' // Assuming favicon exists
             });
          }
        }
        await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, 'notifications', true));
      }
    };

    // Run check 2 seconds after mount/update to allow data to settle
    const timeout = setTimeout(checkOverdue, 5000);
    return () => clearTimeout(timeout);
  }, [records, properties, propertyTypes, payments, users, user, isBooting]);

  const effectiveUser = impersonatedUser || user;

  const value = {
    isBooting, user, users, propertyTypes, properties, records, recordValues, unitHistory, payments, 
    expenses,
    notifications,
    config,
    isSyncing,
    firebaseUser,
    impersonatedUser,
    effectiveUser,
    setImpersonatedUser,
    login, loginWithGoogle, logout,
    addUser, updateUser, deleteUser,
    addPropertyType, updatePropertyType, deletePropertyType,
    addProperty, updateProperty, deleteProperty,
    addRecord, updateRecord, deleteRecord, updateRecordNotes,
    addPayment, togglePayment, deletePayment, updateConfig,
    addExpense, deleteExpense,
    markNotificationAsRead,
    deleteNotification,
    deleteAllNotifications,
    requestNotificationPermission
  };

  return React.createElement(RentalContext.Provider, { value }, children);
};

export const useRentalStore = () => {
  const context = useContext(RentalContext);
  if (!context) throw new Error('useRentalStore must be used within a RentalProvider');
  return context;
};


