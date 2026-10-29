# Lab 04 — StorageClass and Dynamic Provisioning

## Objective

Learn how Kubernetes automatically provisions storage using a StorageClass and PersistentVolumeClaim (PVC).

## Concepts

- **StorageClass:** Defines how storage should be provisioned.
- **Provisioner:** Creates storage in response to a PVC request.
- **Dynamic provisioning:** Kubernetes automatically creates a PV when a PVC requests storage.
- **Default StorageClass:** Used when a PVC does not explicitly specify a StorageClass.
- **WaitForFirstConsumer:** Delays provisioning and binding until a Pod using the PVC is scheduled.
- **Delete reclaim policy:** Dynamically provisioned storage is normally deleted when its PVC is deleted.

## Files

```text
04-dynamic-provisioning/
├── dynamic-pvc.yaml
├── dynamic-pod.yaml
└── README.md
```

## 1. Inspect the StorageClass

Check available StorageClasses:

```powershell
kubectl get storageclass
```

Inspect the default StorageClass:

```powershell
kubectl describe storageclass standard
```

Lab environment configuration:

| Setting | Value |
|---|---|
| StorageClass | `standard` |
| Provisioner | `rancher.io/local-path` |
| Reclaim policy | `Delete` |
| Volume binding mode | `WaitForFirstConsumer` |
| Volume expansion | Not enabled |

## 2. Create the PVC

File: `dynamic-pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 200Mi
```

### Explanation

- `storageClassName: standard` requests storage from the `standard` StorageClass.
- `storage: 200Mi` requests 200 MiB.
- We do not create a PV manually. The provisioner should create one automatically.

Validate and create the PVC:

```powershell
kubectl apply --dry-run=client -f .\dynamic-pvc.yaml
kubectl apply -f .\dynamic-pvc.yaml
kubectl get pvc dynamic-pvc
kubectl get pv
```

### Observation

The PVC initially showed `Pending`, and no new PV was created yet.

This was expected because the StorageClass uses `WaitForFirstConsumer`. Kubernetes waits for a Pod using the claim to be scheduled before provisioning the storage.

## 3. Create a Pod that consumes the PVC

File: `dynamic-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dynamic-pod
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
        claimName: dynamic-pvc
```

### Explanation

- `claimName: dynamic-pvc` connects the Pod to the PVC.
- `mountPath: /data` exposes the volume inside the container.
- The provisioner creates the PV when the Pod is scheduled and the volume is needed.

Validate and create the Pod:

```powershell
kubectl apply --dry-run=client -f .\dynamic-pod.yaml
kubectl apply -f .\dynamic-pod.yaml
kubectl get pod dynamic-pod
kubectl get pvc dynamic-pvc
kubectl get pv
```

### Observation

The Pod became `Running`, the PVC became `Bound`, and Kubernetes automatically created a 200Mi PV.

The generated PV name was:

`pvc-7b6f7a7d-8a8b-4bf6-b2e6-427eb8a61e5b`

The generated PV used the `standard` StorageClass and the `Delete` reclaim policy.

## 4. Write and read data

Write a file into the mounted volume:

```powershell
kubectl exec dynamic-pod -- sh -c "echo 'Hello from dynamic provisioning' > /data/demo.txt"
```

Read the file:

```powershell
kubectl exec dynamic-pod -- cat /data/demo.txt
```

Expected output:

```text
Hello from dynamic provisioning
```

Inspect the resources:

```powershell
kubectl get pv,pvc,pod
```

## 5. Test persistence after Pod recreation

Delete the Pod:

```powershell
kubectl delete pod dynamic-pod
```

Recreate it:

```powershell
kubectl apply -f .\dynamic-pod.yaml
kubectl get pod dynamic-pod
```

Read the existing file:

```powershell
kubectl exec dynamic-pod -- cat /data/demo.txt
```

Expected output:

```text
Hello from dynamic provisioning
```

### Observation

The Pod was deleted and recreated, but the PVC and PV remained. The new Pod mounted the same storage, and the file was still present.

## Static vs dynamic provisioning

| Static provisioning | Dynamic provisioning |
|---|---|
| Administrator creates the PV manually | Provisioner creates the PV automatically |
| PVC claims an existing PV | PVC requests storage through a StorageClass |
| Requires a suitable PV to exist first | Does not require manually creating each PV |
| Demonstrated in Lab 03 | Demonstrated in this lab |

## Important notes

- A StorageClass describes the provisioning method; it is not itself a storage volume.
- `WaitForFirstConsumer` can cause a PVC to remain `Pending` until a Pod uses it.
- `Delete` normally removes dynamically provisioned storage when its PVC is deleted. Actual backend cleanup depends on the provisioner.
- This kind cluster uses local-path storage for learning. It is not equivalent to managed cloud block storage or a highly available shared storage service.

## Cleanup

The Pod, PVC, and dynamically created PV are still present after the persistence test. To clean up the resources:

```powershell
kubectl delete pod dynamic-pod
kubectl delete pvc dynamic-pvc
```

With the `Delete` reclaim policy, the provisioner should remove the associated PV and its managed storage. Verify cleanup:

```powershell
kubectl get pvc
kubectl get pv
```

Do not delete the old `static-pv` from Lab 03 as part of this cleanup; it is a separate retained volume.

## Interview takeaway

A StorageClass defines how storage is provisioned. With dynamic provisioning, an application creates a PVC, and Kubernetes uses the configured provisioner to create a suitable PV automatically. The PVC can then be mounted by a Pod.
