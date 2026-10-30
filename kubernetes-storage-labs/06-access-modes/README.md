# Kubernetes Storage — Access Modes

## Objective

Understand the four Kubernetes PersistentVolume access modes:

- ReadWriteOnce (RWO)
- ReadOnlyMany (ROX)
- ReadWriteMany (RWX)
- ReadWriteOncePod (RWOP)

## Environment

- Windows 11
- PowerShell
- Docker Desktop
- kind Kubernetes cluster
- Kubernetes v1.37.0
- kubectl
- StorageClass: `standard`
- Provisioner: `rancher.io/local-path`

## 1. What are Access Modes?

Access modes define how a PersistentVolume can be mounted by workloads.

They describe the volume's mounting capabilities, not filesystem permissions.

### Access Mode Comparison

| Access Mode | Meaning |
|---|---|
| RWO | Read/write mounting by one node at a time |
| ROX | Read-only mounting by multiple nodes |
| RWX | Read/write mounting by multiple nodes |
| RWOP | Read/write mounting by one Pod across the cluster |

**Important distinction:**

- RWO does not mean one Pod. Multiple Pods on the same node can mount an RWO volume if the storage driver supports it.
- RWOP restricts read/write mounting to a single Pod.
- Actual access-mode support depends on the storage backend and driver.

## 2. RWO — ReadWriteOnce

RWO allows a volume to be mounted as read-write by one node at a time.

Multiple Pods on that same node can potentially mount the volume.

### Step 1: Create an RWO PVC

File: `rwo-pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: rwo-demo-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 100Mi
```

Validate and create:

```powershell
kubectl apply --dry-run=client -f .\rwo-pvc.yaml
kubectl apply -f .\rwo-pvc.yaml
```

### Step 2: Create the first Pod

File: `rwo-pod-1.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: rwo-pod-1
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo 'Written by Pod 1' > /data/demo.txt && sleep 3600"]
      volumeMounts:
        - name: storage
          mountPath: /data
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: rwo-demo-pvc
```

Validate and create:

```powershell
kubectl apply --dry-run=client -f .\rwo-pod-1.yaml
kubectl apply -f .\rwo-pod-1.yaml
```

Verify:

```powershell
kubectl get pod rwo-pod-1
kubectl get pvc rwo-demo-pvc
kubectl get pv
```

The Pod reached `Running`, and the PVC became `Bound`.

### Step 3: Create a second Pod using the same PVC

File: `rwo-pod-2.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: rwo-pod-2
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: storage
          mountPath: /data
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: rwo-demo-pvc
```

Validate and create:

```powershell
kubectl apply --dry-run=client -f .\rwo-pod-2.yaml
kubectl apply -f .\rwo-pod-2.yaml
```

### Step 4: Verify shared access

Check both Pods:

```powershell
kubectl get pods
```

Read the file written by Pod 1 from Pod 2:

```powershell
kubectl exec rwo-pod-2 -- cat /data/demo.txt
```

Expected output:

```text
Written by Pod 1
```

**Observation:**

Both Pods successfully mounted the same RWO PVC on the same Kubernetes node.

This demonstrated that RWO means one node at a time, not one Pod at a time.

## 3. ROX — ReadOnlyMany

ROX allows multiple nodes to mount a volume in read-only mode.

Example use case:

Multiple application servers reading the same shared configuration files.

Key points:

- Multiple nodes can mount the volume.
- Mounts are read-only.
- The storage backend must support ROX.

This mode was studied conceptually because the local-path provisioner in this lab environment is not suitable for demonstrating genuine multi-node ROX access.

## 4. RWX — ReadWriteMany

RWX allows multiple nodes to mount the same volume for reading and writing simultaneously.

Example use case:

Multiple application servers sharing uploaded files.

Storage backends that can support RWX include:

- NFS
- Amazon EFS
- Azure Files
- CephFS

This mode was studied conceptually because the current local-path provisioner does not provide a suitable shared multi-node storage backend.

## 5. RWOP — ReadWriteOncePod

RWOP allows a volume to be mounted as read-write by only one Pod across the cluster.

Example use case:

A database workload that should have exclusive access to its persistent storage.

Key difference:

- RWO: Multiple Pods may mount the volume on the same node.
- RWOP: Only one Pod can mount the volume for read-write access across the cluster.

Actual enforcement depends on supported Kubernetes and storage-driver functionality.

## 6. StorageClass Inspection

Command:

```powershell
kubectl get storageclass standard -o yaml
```

Important configuration:

```yaml
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
```

Observations:

- The cluster uses the Rancher local-path provisioner.
- Storage is node-local rather than shared network storage.
- `WaitForFirstConsumer` delays binding until a Pod uses the PVC and is scheduled.
- The single-node kind cluster cannot demonstrate genuine multi-node access behaviour.

## 7. Cleanup

Delete the Pods:

```powershell
kubectl delete pod rwo-pod-1 rwo-pod-2
```

Delete the PVC:

```powershell
kubectl delete pvc rwo-demo-pvc
```

Verify:

```powershell
kubectl get pods
kubectl get pvc
kubectl get pv
```

The dynamically provisioned PV associated with `rwo-demo-pvc` disappeared because its reclaim policy was `Delete`.

Existing resources from earlier labs were preserved.

## 8. Important Commands

| Command | Purpose |
|---|---|
| `kubectl get pods` | List Pods |
| `kubectl get pvc` | List PersistentVolumeClaims |
| `kubectl get pv` | List PersistentVolumes |
| `kubectl get storageclass` | List StorageClasses |
| `kubectl describe pvc <name>` | Inspect PVC details and events |
| `kubectl exec <pod> -- cat /data/demo.txt` | Read a file inside a Pod |

## What I Learned

- Access modes define how volumes can be mounted.
- RWO allows read/write mounting by one node at a time.
- Multiple Pods on the same node can share an RWO volume when supported by the driver.
- ROX supports read-only mounting from multiple nodes.
- RWX supports read/write mounting from multiple nodes.
- RWOP restricts read/write mounting to one Pod.
- Storage-driver capabilities matter when selecting access modes.
- A single-node kind cluster with local-path storage has limitations for demonstrating multi-node access modes.