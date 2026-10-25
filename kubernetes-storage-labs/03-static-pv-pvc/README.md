# Lab 03 — Static PersistentVolume and PersistentVolumeClaim

## Objective

Learn how to create a static PersistentVolume (PV), claim it using a PersistentVolumeClaim (PVC), mount it into a Pod, and test data persistence.

## Concepts

- **PersistentVolume (PV):** A Kubernetes resource representing storage.
- **PersistentVolumeClaim (PVC):** A request for storage by a user or application.
- **Static provisioning:** An administrator creates the PV before a PVC requests it.
- **Binding:** Kubernetes associates a suitable PV with a PVC.
- **Reclaim policy — Retain:** Preserves the underlying storage when the PVC is deleted. The PV becomes `Released` and requires manual recovery before reuse.
- **ReadWriteOnce (RWO):** Allows read-write mounting by one node at a time. Multiple Pods on that node may be able to use it, depending on the storage implementation.

## Files

```text
03-static-pv-pvc/
├── pv.yaml
├── pvc.yaml
├── pvc-pod.yaml
└── README.md
```

## 1. Create the PersistentVolume

File: `pv.yaml`

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: static-pv
spec:
  capacity:
    storage: 100Mi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    path: /mnt/static-pv-data
    type: DirectoryOrCreate
```

### Explanation

- `capacity.storage: 100Mi` declares the PV's capacity.
- `accessModes` specifies the supported access mode.
- `persistentVolumeReclaimPolicy: Retain` preserves the storage after PVC deletion.
- `hostPath` uses a directory on the Kubernetes node.
- `DirectoryOrCreate` creates the directory if it doesn't exist.
- The PV has no StorageClass, so it can be used for this static provisioning exercise.

Validate and create the PV:

```powershell
kubectl apply --dry-run=client -f .\pv.yaml
kubectl apply -f .\pv.yaml
kubectl get pv
kubectl describe pv static-pv
```

Expected initial status: `Available`.

## 2. Create the PersistentVolumeClaim

File: `pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: static-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: ""
  volumeName: static-pv
  resources:
    requests:
      storage: 50Mi
```

### Explanation

- `storageClassName: ""` explicitly requests no StorageClass.
- `volumeName: static-pv` requests this specific PV.
- `storage: 50Mi` requests 50 MiB of storage.
- The PV declares 100 MiB, which is enough for this request.

Validate, create, and inspect:

```powershell
kubectl apply --dry-run=client -f .\pvc.yaml
kubectl apply -f .\pvc.yaml
kubectl get pvc
kubectl get pv
kubectl describe pvc static-pvc
```

Expected result: the PVC and PV become `Bound`.

The PVC shows 100 MiB capacity because it is bound to the existing 100 MiB PV; Kubernetes doesn't resize the PV to 50 MiB.

## 3. Mount the PVC into a Pod

File: `pvc-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pvc-demo
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: app-storage
          mountPath: /data
  volumes:
    - name: app-storage
      persistentVolumeClaim:
        claimName: static-pvc
```

### Explanation

- `persistentVolumeClaim.claimName` tells Kubernetes which PVC to use.
- `volumeMounts.mountPath: /data` makes the volume accessible inside the container.
- `sleep 3600` keeps the container running for testing.

Validate and create the Pod:

```powershell
kubectl apply --dry-run=client -f .\pvc-pod.yaml
kubectl apply -f .\pvc-pod.yaml
kubectl get pod pvc-demo
```

## 4. Write and read data

Write a file:

```powershell
kubectl exec pvc-demo -- sh -c "echo 'Hello from static PV and PVC' > /data/demo.txt"
```

Read it:

```powershell
kubectl exec pvc-demo -- cat /data/demo.txt
```

Expected output:

```text
Hello from static PV and PVC
```

Inspect the resources:

```powershell
kubectl get pv,pvc,pod
```

## 5. Test persistence after Pod deletion

Delete the Pod:

```powershell
kubectl delete pod pvc-demo
```

Recreate it using the same PVC:

```powershell
kubectl apply -f .\pvc-pod.yaml
kubectl get pod pvc-demo
kubectl exec pvc-demo -- cat /data/demo.txt
```

Expected output:

```text
Hello from static PV and PVC
```

The data remains because the recreated Pod mounts the same PVC and PV.

## 6. Test the Retain reclaim policy

Delete the Pod before deleting its PVC:

```powershell
kubectl delete pod pvc-demo
kubectl delete pvc static-pvc
kubectl get pv
```

Expected PV status: `Released`.

Verify the retained file on the kind node:

```powershell
docker exec storage-lab-control-plane cat /mnt/static-pv-data/demo.txt
```

Expected output:

```text
Hello from static PV and PVC
```

### Why does the PV become Released?

The PVC has been deleted, but the PV retains its previous claim reference. Kubernetes preserves the storage because the reclaim policy is `Retain`. It does not automatically make this PV available for another claim.

## Important observations

| Event | Result |
|---|---|
| PV created | `Available` |
| PVC created and matched | `Bound` |
| Pod writes data | File exists in `/data` |
| Pod deleted and recreated | File remains |
| PVC deleted with `Retain` | PV becomes `Released` |
| Retained file checked on node | File remains |

## Limitations

- `hostPath` is tied to a specific Kubernetes node and is used here for learning.
- The declared PV capacity is not a hard disk quota enforced on the directory.
- `ReadWriteOnce` is a node-level access mode, not a filesystem permission setting.
- A `Released` PV generally needs administrator intervention before it can be reused.

## Cleanup and recovery notes

At the end of this lab, the PVC and Pod have been deleted, but `static-pv` remains `Released` and the test file remains on the kind node.

Do not delete the PV or node directory unless you intend to remove this test storage. If you later want to reset the lab, inspect the PV and its retained data first.

## Interview takeaway

A PV represents storage, a PVC requests storage, and a Pod consumes storage through a PVC. With the `Retain` reclaim policy, deleting the PVC preserves the underlying data, but the PV requires manual recovery before reuse.
