# Kubernetes Storage Troubleshooting

## Objective

Practiced troubleshooting common Kubernetes storage problems using `kubectl`, PVCs, Pods, Persistent Volumes, and Kubernetes Events.

Environment:
- Windows 11
- PowerShell
- Docker Desktop
- kind
- kubectl
- Kubernetes StorageClass: `standard`
- Provisioner: `rancher.io/local-path`

---

## 1. Troubleshooting an Invalid StorageClass

### Scenario

Created a PVC referencing a StorageClass that does not exist.

### pending-pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pending-demo-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: invalid-storage-class
  resources:
    requests:
      storage: 100Mi
```

### Commands

```powershell
kubectl apply --dry-run=client -f .\pending-pvc.yaml
kubectl apply -f .\pending-pvc.yaml
kubectl get pvc pending-demo-pvc
kubectl describe pvc pending-demo-pvc
kubectl get storageclass
```

### Observed error

```text
ProvisioningFailed:
storageclass.storage.k8s.io "invalid-storage-class" not found
```

### Root cause

The requested StorageClass did not exist in the cluster.

### Resolution

Deleted the faulty PVC, changed its StorageClass to `standard`, and recreated it.

**Important:** PVC storage class configuration is generally immutable after creation. Delete and recreate the claim to correct this configuration.

---

## 2. Understanding WaitForFirstConsumer

The `standard` StorageClass uses:

```yaml
volumeBindingMode: WaitForFirstConsumer
```

This means Kubernetes waits for a Pod to consume the PVC before provisioning and binding the volume.

### Corrected pending-pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pending-demo-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 100Mi
```

### Commands

```powershell
kubectl apply --dry-run=client -f .\pending-pvc.yaml
kubectl apply -f .\pending-pvc.yaml
kubectl get pvc pending-demo-pvc
```

Initially, the PVC remained Pending. This was expected behavior.

---

## 3. Creating a Pod to Consume the PVC

### pending-demo-pod.yaml

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pending-demo-pod
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "echo Storage provisioned successfully > /data/demo.txt && sleep 3600"]
      volumeMounts:
        - name: storage
          mountPath: /data
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: pending-demo-pvc
```

### Commands

```powershell
kubectl apply -f .\pending-demo-pod.yaml
kubectl get pods
kubectl get pvc
kubectl get pv
```

### Verification

```powershell
kubectl exec pending-demo-pod -- cat /data/demo.txt
```

Expected output:

```text
Storage provisioned successfully
```

### What happened?

1. Created a PVC using the `standard` StorageClass.
2. PVC remained Pending because of `WaitForFirstConsumer`.
3. Created a Pod that consumed the PVC.
4. Kubernetes dynamically provisioned a Persistent Volume.
5. PVC transitioned to Bound.
6. Pod transitioned to Running.
7. Verified that data could be written to and read from the mounted volume.

---

## 4. Inspecting Kubernetes Events

### Command

```powershell
kubectl get events --sort-by=.metadata.creationTimestamp
```

### Important events observed

| Event | Meaning |
|---|---|
| ProvisioningFailed | Storage provisioning failed |
| WaitForFirstConsumer | Waiting for a Pod to consume the PVC |
| ExternalProvisioning | Waiting for the external provisioner |
| Provisioning | Volume creation started |
| ProvisioningSucceeded | Volume successfully created |
| Scheduled | Pod assigned to a node |
| Started | Container started |

Events help identify what happened and why.

---

## 5. Troubleshooting PVC Binding Failure

### Scenario

Created a PVC requesting 500Mi without a StorageClass or dynamic provisioning.

### binding-failure-pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: binding-failure-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: ""
  resources:
    requests:
      storage: 500Mi
```

### Commands

```powershell
kubectl apply --dry-run=client -f .\binding-failure-pvc.yaml
kubectl apply -f .\binding-failure-pvc.yaml
kubectl get pvc binding-failure-pvc
kubectl describe pvc binding-failure-pvc
```

### Observed error

```text
FailedBinding:
no persistent volumes available for this claim and no storage class is set
```

### Root cause

- No available static PV matched the claim.
- Dynamic provisioning was disabled using `storageClassName: ""`.
- PVC remained Pending.

---

## 6. Troubleshooting a Pod Referencing a Missing PVC

### Scenario

Created a Pod referencing a PVC that does not exist.

### missing-pvc-pod.yaml

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: missing-pvc-pod
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
        claimName: nonexistent-pvc
```

### Commands

```powershell
kubectl apply --dry-run=client -f .\missing-pvc-pod.yaml
kubectl apply -f .\missing-pvc-pod.yaml
kubectl get pod missing-pvc-pod
kubectl describe pod missing-pvc-pod
```

### Observed error

```text
FailedScheduling:
0/1 nodes are available:
persistentvolumeclaim "nonexistent-pvc" not found
```

### Root cause

The Pod referenced a PVC that did not exist in its namespace.

---

## 7. Kubernetes Storage Troubleshooting Commands

```powershell
# List Pods
kubectl get pods

# List Persistent Volume Claims
kubectl get pvc

# List Persistent Volumes
kubectl get pv

# List StorageClasses
kubectl get storageclass

# Inspect a PVC
kubectl describe pvc <pvc-name>

# Inspect a Pod
kubectl describe pod <pod-name>

# Display cluster events in chronological order
kubectl get events --sort-by=.metadata.creationTimestamp

# Read a file inside a container
kubectl exec <pod-name> -- cat /data/demo.txt

# Validate YAML before applying
kubectl apply --dry-run=client -f <filename>

# Apply a YAML manifest
kubectl apply -f <filename>
```

---

## 8. Cleanup

Removed only the resources created during this lab.

```powershell
kubectl delete pod pending-demo-pod missing-pvc-pod

kubectl delete pvc pending-demo-pvc binding-failure-pvc
```

### Final verification

```powershell
kubectl get pods
kubectl get pvc
kubectl get pv
kubectl get storageclass
```

Confirmed that previous lab resources remained intact:

- `dynamic-pod` — Running
- `hostpath-demo` — Running
- `dynamic-pvc` — Bound
- Dynamically provisioned PV — Bound
- `static-pv` — Released with Retain policy
- `standard` StorageClass — Available

---

## Key Learnings

1. How to diagnose an invalid StorageClass.
2. Why a PVC can remain Pending with `WaitForFirstConsumer`.
3. How dynamic provisioning is triggered by a consuming Pod.
4. How to diagnose a PVC binding failure.
5. How to troubleshoot Pods referencing missing PVCs.
6. How to inspect Kubernetes Events.
7. How to use `kubectl describe` to investigate resource-specific problems.

**Conclusion:** Successfully completed Kubernetes storage troubleshooting exercises using kind and kubectl.