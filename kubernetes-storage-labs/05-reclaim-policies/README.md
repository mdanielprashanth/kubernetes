# Kubernetes Reclaim Policies — Retain vs Delete

## Objective

Understand what happens to a PersistentVolume (PV) when its PersistentVolumeClaim (PVC) is deleted.

## Environment

- Windows 11
- PowerShell
- Docker Desktop
- kind Kubernetes cluster
- kubectl
- StorageClass: `standard`
- Provisioner: `rancher.io/local-path`

## Key Concepts

### 1. Reclaim Policy

A reclaim policy determines what Kubernetes does with a PV after its PVC is deleted.

| Policy | Behaviour |
|---|---|
| `Retain` | Preserves the PV and underlying storage for manual recovery. |
| `Delete` | Requests deletion of the PV and its provisioner-managed storage. |

### 2. Retain Policy — Previous Lab

In Lab 03, I created a static PV named `static-pv` with the `Retain` policy.

After deleting its PVC, the PV remained in the `Released` state.

This demonstrated that the volume was preserved and required manual recovery before reuse.

### 3. Delete Policy — Current Lab

The default StorageClass, `standard`, uses the `Delete` reclaim policy.

I created a PVC named `delete-test-pvc` requesting 100Mi of storage.

#### Step 1: Create the PVC

File: `delete-pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: delete-test-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 100Mi
```

Validate and create the PVC:

```powershell
kubectl apply --dry-run=client -f .\delete-pvc.yaml
kubectl apply -f .\delete-pvc.yaml
```

The PVC may initially remain `Pending` because the StorageClass uses `WaitForFirstConsumer`.

#### Step 2: Create a Pod that uses the PVC

File: `delete-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: delete-test-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo 'Testing Delete reclaim policy' > /data/demo.txt && sleep 3600"]
      volumeMounts:
        - name: storage
          mountPath: /data
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: delete-test-pvc
```

Validate and create the Pod:

```powershell
kubectl apply --dry-run=client -f .\delete-pod.yaml
kubectl apply -f .\delete-pod.yaml
```

#### Step 3: Verify the resources

```powershell
kubectl get pod delete-test-pod
kubectl get pvc delete-test-pvc
kubectl get pv
```

The Pod reached `Running`, the PVC became `Bound`, and Kubernetes dynamically provisioned a 100Mi PV with the `Delete` policy.

#### Step 4: Verify the stored file

```powershell
kubectl exec delete-test-pod -- cat /data/demo.txt
```

Output:

```text
Testing Delete reclaim policy
```

This confirmed that the container could write to the mounted persistent volume.

#### Step 5: Delete the Pod and PVC

```powershell
kubectl delete pod delete-test-pod
kubectl delete pvc delete-test-pvc
```

Then check the PVs:

```powershell
kubectl get pv
```

The dynamically provisioned PV associated with `delete-test-pvc` disappeared after cleanup.

The existing `dynamic-pvc` and its PV remained intact, as did the retained `static-pv`.

## Important Observations

- A PVC requests storage; a PV represents the storage resource Kubernetes manages.
- Dynamic provisioning creates a PV automatically when a suitable PVC is used.
- `WaitForFirstConsumer` can delay provisioning or binding until a Pod uses the PVC and is scheduled.
- With `Delete`, the provisioner is expected to clean up its managed storage. Exact backend cleanup depends on the provisioner.
- With `Retain`, the administrator must handle recovery and reuse manually.
- Deleting a Pod alone does not normally delete its PVC or PV.

## Useful Commands

```powershell
kubectl get pods
kubectl get pvc
kubectl get pv
kubectl describe pvc delete-test-pvc
kubectl describe pv static-pv
```

Note: `describe` commands for deleted resources will no longer work. Run them while the resources exist.

## Cleanup Status

- `delete-test-pod`: deleted
- `delete-test-pvc`: deleted
- Associated dynamically provisioned PV: disappeared
- Existing `dynamic-pod` and `dynamic-pvc`: preserved
- Existing `hostpath-demo`: preserved
- Existing `static-pv` with `Retain`: preserved in `Released` state

## What I Learned

I learned how `Retain` and `Delete` reclaim policies behave when a PVC is deleted, how to inspect PV/PVC states, and how to verify the lifecycle of dynamically provisioned storage.
