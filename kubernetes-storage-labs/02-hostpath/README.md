# Lab 02 — Kubernetes hostPath Volume

## 1. Objective

Learn how Kubernetes `hostPath` volumes mount a directory from the Kubernetes node into a container.

Environment:
- Windows 11
- PowerShell
- Docker Desktop
- kind
- kubectl
- BusyBox image `busybox:1.36`

## 2. What is hostPath?

A `hostPath` volume mounts a file or directory from the Kubernetes node's filesystem into a Pod.

In this lab, the paths are:

- Node path: `/tmp/hostpath-demo`
- Container path: `/data`

Because kind runs Kubernetes nodes inside Docker containers, the node path is inside the kind node container, not directly on Windows.

## 3. Files in this lab

```text
02-hostpath/
├── hostpath-pod.yaml
└── README.md
```

- `hostpath-pod.yaml`: Defines the Pod and its volume.
- `README.md`: Documents the lab, commands, and results.

## 4. YAML configuration

File: `hostpath-pod.yaml`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-demo
spec:
  containers:
    - name: hostpath-container
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: host-storage
          mountPath: /data
  volumes:
    - name: host-storage
      hostPath:
        path: /tmp/hostpath-demo
        type: DirectoryOrCreate
```

### Explanation

- `apiVersion: v1`: Uses the Kubernetes core API.
- `kind: Pod`: Creates a Pod.
- `metadata.name`: Names the Pod `hostpath-demo`.
- `containers`: Lists the containers in the Pod.
- `image: busybox:1.36`: Uses a lightweight image containing basic Linux utilities.
- `command`: Runs `sleep 3600` to keep the container running for one hour.
- `volumeMounts`: Mounts the volume inside the container.
- `name: host-storage`: Identifies the volume.
- `mountPath: /data`: Makes the volume accessible at `/data` inside the container.
- `hostPath.path`: Specifies the directory on the Kubernetes node.
- `DirectoryOrCreate`: Creates the directory on the node if it does not exist.

## 5. Commands performed

### Check the cluster

```powershell
kind get clusters
kubectl get nodes
```

`kind get clusters` lists kind clusters. `kubectl get nodes` checks Kubernetes node status.

### Validate the YAML

```powershell
kubectl apply --dry-run=client -f .\hostpath-pod.yaml
```

Checks the manifest without creating the Pod.

Expected output:

```text
pod/hostpath-demo created (dry run)
```

### Create the Pod

```powershell
kubectl apply -f .\hostpath-pod.yaml
```

Creates the Pod from the YAML file.

### Check Pod status

```powershell
kubectl get pod hostpath-demo
kubectl get pods
```

Confirm that the Pod reaches `Running` and shows `1/1` Ready.

### Write a file inside the mounted volume

```powershell
kubectl exec hostpath-demo -- sh -c "echo 'Hello from hostpath' > /data/demo.txt"
```

Explanation:
- `kubectl exec`: Runs a command inside a container.
- `--`: Separates kubectl arguments from the command being executed.
- `sh -c`: Executes the supplied shell command.
- `echo`: Produces the text.
- `>`: Redirects the text into a file.
- `/data/demo.txt`: The file inside the mounted volume.

### Read the file inside the Pod

```powershell
kubectl exec hostpath-demo -- cat /data/demo.txt
```

Expected output:

```text
Hello from hostpath
```

### Inspect the node directory

```powershell
docker exec storage-lab-control-plane ls -l /tmp/hostpath-demo
```

Lists files and details in the node directory.

```powershell
docker exec storage-lab-control-plane cat /tmp/hostpath-demo/demo.txt
```

Displays the file's contents directly from the kind node.

Command breakdown:
- `docker exec`: Executes a command inside a running Docker container.
- `storage-lab-control-plane`: The Docker container running the kind node.
- `cat`: Displays a file's contents.
- `/tmp/hostpath-demo/demo.txt`: The file's location inside the node.

Expected output:

```text
Hello from hostpath
```

### Delete the Pod

```powershell
kubectl delete pod hostpath-demo
```

Deletes the Pod, but does not automatically delete the `hostPath` directory.

### Verify that the file remains

```powershell
docker exec storage-lab-control-plane cat /tmp/hostpath-demo/demo.txt
```

Expected output:

```text
Hello from hostpath
```

This confirms that the data survived Pod deletion.

### Recreate the Pod

```powershell
kubectl apply -f .\hostpath-pod.yaml
kubectl get pods
```

Recreates the Pod and checks its status.

### Read the existing file from the new Pod

```powershell
kubectl exec hostpath-demo -- cat /data/demo.txt
```

Expected output:

```text
Hello from hostpath
```

The new Pod mounts the same node directory and can read the previous file.

## 6. What I learned

1. `hostPath` mounts a directory or file from a Kubernetes node into a Pod.
2. A volume mount makes the node directory accessible inside the container.
3. The node and container use different paths to access the same data.
4. Deleting a Pod does not automatically remove the `hostPath` data.
5. A replacement Pod can access the existing data if it mounts the same node directory.
6. In kind, the node filesystem is inside a Docker container.
7. `hostPath` is tied to a particular node and is not a substitute for managed, portable persistent storage.

## 7. Important caution

`hostPath` can expose sensitive node files and creates a dependency on a particular node's filesystem. It is generally not the preferred storage mechanism for portable production applications.

For durable application storage, learn PersistentVolumes (PV), PersistentVolumeClaims (PVC), and StorageClasses.

## 8. Cleanup

Delete the Pod when you have finished the lab:

```powershell
kubectl delete pod hostpath-demo
```

This does not automatically delete `/tmp/hostpath-demo` from the node.

To remove the test directory from the kind node after confirming you no longer need its contents:

```powershell
docker exec storage-lab-control-plane rm -rf /tmp/hostpath-demo
```

**Warning:** This permanently removes that directory and its contents from the node. Only run it when you are ready to clean up the test data.

Do not delete the entire kind cluster if you intend to continue using it for the next storage labs.

## 9. Interview takeaway

**Question:** What is the difference between `emptyDir` and `hostPath`?

**Answer:** `emptyDir` is temporary storage associated with a Pod and is deleted when the Pod is removed. `hostPath` mounts a directory from the node's filesystem, so its contents can survive Pod deletion, but the data is tied to that node.
