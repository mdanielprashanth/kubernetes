# Kubernetes `emptyDir` Volume --- Hands-on Lab

## Goal

This lab demonstrates how Kubernetes `emptyDir` storage works:

-   Create a Pod with an `emptyDir` volume.
-   Write and read a file in the mounted volume.
-   Restart the container using a liveness probe and verify that the
    file survives.
-   Delete and recreate the Pod, then verify that the old file is gone.

**Environment:** Windows PowerShell, Docker Desktop, `kind`, and
`kubectl`.

## 1. What is `emptyDir`?

An `emptyDir` is temporary storage created for a Pod when Kubernetes
assigns the Pod to a node. A container can access it by mounting the
volume at a path such as `/data`.

-   The volume starts empty.
-   Containers in the same Pod can share it if they mount the same
    volume.
-   Its contents normally survive a container restart while the Pod
    remains.
-   When the Pod is deleted, the `emptyDir` volume and its contents are
    deleted.
-   A newly created Pod gets a new, empty `emptyDir`.

Use it for temporary files, caches, and intermediate data---not for data
that must survive Pod deletion.

## 2. Create the lab folder

Run these commands in PowerShell. Adjust the parent path if your local
folder is elsewhere.

``` powershell
cd "D:\STUDIES\Docker-Kubernetes\Kubernetes\kinD"
mkdir kubernetes-storage-labs
cd kubernetes-storage-labs
mkdir emptydir-demo
cd emptydir-demo
```

**Explanation**

-   `cd` changes the current directory.
-   `mkdir` creates a directory.
-   Keeping this lab separate from the HPA project makes it easier to
    find and maintain as a GitHub learning reference.

If the folders already exist, do not create duplicates; just `cd` into
the existing `emptydir-demo` folder.

## 3. Create a kind cluster

The previous HPA lab cluster had been deleted, so a new cluster was
needed.

``` powershell
kind create cluster --name storage-lab
kubectl get nodes
```

**Explanation**

-   `kind create cluster --name storage-lab` creates a local Kubernetes
    cluster named `storage-lab`.
-   `kubectl get nodes` lists the cluster's nodes. The node should
    eventually show `Ready`.

Docker Desktop must be running. `kind` and `kubectl` are separate tools;
deleting a cluster does not uninstall them.

## 4. Generate a basic Pod YAML

Run this from the `emptydir-demo` directory:

``` powershell
kubectl run emptydir-demo --image=busybox:1.36 --restart=Never --dry-run=client -o yaml --validate=false > emptydir-pod.yaml
```

**Explanation**

-   `kubectl run emptydir-demo` generates a Pod definition named
    `emptydir-demo`.
-   `--image=busybox:1.36` selects the BusyBox container image.
-   `--restart=Never` generates a Pod rather than a Deployment.
-   `--dry-run=client` asks kubectl to generate the resource without
    creating it.
-   `-o yaml` outputs YAML.
-   `--validate=false` disables schema validation that, in this
    environment, was causing kubectl to contact the API server during
    generation.
-   `>` redirects the output into `emptydir-pod.yaml`.

The generated file is a basic Pod. It does not yet define a volume.

To inspect it:

``` powershell
notepad emptydir-pod.yaml
```

`notepad` opens the YAML file for editing.

### Initial generated YAML

The generated file looked similar to this:

``` yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: emptydir-demo
  name: emptydir-demo
spec:
  containers:
  - image: busybox:1.36
    name: emptydir-demo
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Never
status: {}
```

We then edited it to add the volume mount and volume definition.

## 5. Final Pod YAML

Replace the generated content in `emptydir-pod.yaml` with the following.
This version includes a liveness probe so the container-restart test can
be performed.

``` yaml
apiVersion: v1
kind: Pod
metadata:
  name: emptydir-demo
spec:
  containers:
    - image: busybox:1.36
      name: emptydir-demo
      command: ["sh", "-c", "sleep 3600"]
      livenessProbe:
        exec:
          command: ["sh", "-c", "test ! -f /tmp/restart-me"]
        initialDelaySeconds: 10
        periodSeconds: 5
        failureThreshold: 1
      volumeMounts:
        - name: temporary-storage
          mountPath: /data
  volumes:
    - name: temporary-storage
      emptyDir: {}
```

### Important YAML fields

-   `command: ["sh", "-c", "sleep 3600"]`: runs a shell command that
    sleeps for 3,600 seconds (one hour), keeping the container running
    for the experiment.
-   `volumeMounts`: defines where a volume appears inside a container.
-   `name: temporary-storage`: the volume's name. It must match the name
    in `spec.volumes`.
-   `mountPath: /data`: the path inside the container where the volume
    is mounted.
-   `volumes`: defines the Pod's volumes.
-   `emptyDir: {}`: asks Kubernetes to create an initially empty
    temporary volume.

### Understanding the liveness probe

``` yaml
livenessProbe:
  exec:
    command: ["sh", "-c", "test ! -f /tmp/restart-me"]
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 1
```

-   `exec`: runs a command inside the container as the health check.
-   `test ! -f /tmp/restart-me`: succeeds if `/tmp/restart-me` does
    **not** exist; it fails if the file exists.
-   `initialDelaySeconds: 10`: waits 10 seconds after the container
    starts before probing.
-   `periodSeconds: 5`: runs the probe every five seconds.
-   `failureThreshold: 1`: one failed probe is enough to trigger a
    container restart.

The marker file is under `/tmp`, not `/data`. `/tmp` belongs to the
container's writable filesystem; `/data` is the mounted `emptyDir`.

## 6. Validate and create the Pod

### Client-side dry run

``` powershell
kubectl apply --dry-run=client -f .\emptydir-pod.yaml
```

-   `kubectl apply` processes a resource manifest.
-   `--dry-run=client` checks the manifest without creating the Pod.
-   `-f .\emptydir-pod.yaml` tells kubectl which file to read.
-   `.\` is PowerShell's relative-path notation for the current
    directory.

Expected output:

``` text
pod/emptydir-demo created (dry run)
```

### Apply the manifest

``` powershell
kubectl apply -f .\emptydir-pod.yaml
```

This creates the Pod (or applies supported changes to an existing
resource).

### Check its status

``` powershell
kubectl get pod emptydir-demo
```

Wait until `STATUS` is `Running` and `READY` is `1/1`.

## 7. Write and read a file in `emptyDir`

### Write the file

``` powershell
kubectl exec emptydir-demo -- sh -c "echo 'hello from emptyDir' > /data/demo.txt"
```

**Explanation**

-   `kubectl exec emptydir-demo` runs a command in the Pod's container.
-   `--` separates kubectl's options from the command to run inside the
    container. Keep a space after `--`.
-   `sh -c` executes the quoted shell command.
-   `echo ... > /data/demo.txt` writes the text to the file, creating it
    if needed.
-   The file is stored under `/data`, the volume mount.

### Read the file

``` powershell
kubectl exec emptydir-demo -- cat /data/demo.txt
```

`cat` prints the file contents. Expected output:

``` text
hello from emptyDir
```

## 8. Test whether the data survives a container restart

### Add a test file to the volume

Use this content for the restart test:

``` powershell
kubectl exec emptydir-demo -- sh -c "echo 'emptyDir data survives container restart' > /data/demo.txt"
kubectl exec emptydir-demo -- cat /data/demo.txt
```

The second command should print:

``` text
emptyDir data survives container restart
```

### Trigger the liveness probe

``` powershell
kubectl exec emptydir-demo -- touch /tmp/restart-me
```

-   `touch` creates the marker file.
-   The liveness probe now fails because the marker exists.

Watch the Pod:

``` powershell
kubectl get pod emptydir-demo -w
```

-   `-w` means watch; kubectl keeps printing updates.
-   Wait for `RESTARTS` to increase, then press `Ctrl+C` to stop
    watching.

### Verify both files' behavior

Check the volume file:

``` powershell
kubectl exec emptydir-demo -- cat /data/demo.txt
```

Expected output:

``` text
emptyDir data survives container restart
```

Check the marker file:

``` powershell
kubectl exec emptydir-demo -- ls /tmp/restart-me
```

After the restart, this should report:

``` text
ls: /tmp/restart-me: No such file or directory
```

That error is expected: it proves the marker file in the container's
writable filesystem disappeared. The data in `/data/demo.txt` survived
because the Pod and its `emptyDir` volume remained.

## 9. Test what happens when the Pod is deleted

Delete the Pod:

``` powershell
kubectl delete pod emptydir-demo
```

Expected output is similar to:

``` text
pod "emptydir-demo" deleted
```

Check that it is gone:

``` powershell
kubectl get pod emptydir-demo
```

A `NotFound` error is expected because the Pod no longer exists.

**Important:** deleting the Pod deletes its `emptyDir` volume and the
data stored in it.

### Recreate the Pod

``` powershell
kubectl apply -f .\emptydir-pod.yaml
kubectl get pod emptydir-demo
```

Wait until the Pod is `Running`, then check the old file:

``` powershell
kubectl exec emptydir-demo -- cat /data/demo.txt
```

Expected result:

``` text
cat: can't open '/data/demo.txt': No such file or directory
```

This is expected. The recreated Pod has a new, empty `emptyDir`.

## 10. Summary

  Event                                     Does the `emptyDir` data survive?
  ----------------------------------------- -----------------------------------
  Container restart while the Pod remains   Yes
  Pod deletion                              No
  Pod recreated from the same YAML          No; the new volume starts empty

### Interview takeaway

**`emptyDir` is temporary storage scoped to a Pod.** It is useful for
scratch space, caches, and sharing temporary files between containers in
the same Pod. It is not suitable for data that must survive Pod deletion
or replacement; for that, learn PersistentVolumes (PV),
PersistentVolumeClaims (PVC), and StorageClasses.

## 11. Useful troubleshooting notes

### `kubectl` cannot connect to `localhost:8080`

Example:

``` text
Unable to connect to the server: dial tcp [::1]:8080: connectex: No connection could be made
```

This often means no cluster is available in the current kubectl context,
or the configured API server cannot be reached. Check:

``` powershell
kind get clusters
kubectl config current-context
kubectl get nodes
```

If the intended lab cluster does not exist, and Docker Desktop is
running, create it:

``` powershell
kind create cluster --name storage-lab
```

### `unknown flag: --sh`

Use a space after the separator:

``` powershell
kubectl exec emptydir-demo -- sh -c "echo test > /data/demo.txt"
```

Not `--sh`.

### Pod updates are rejected as immutable

Some Pod fields, including a liveness probe added after creation, cannot
be changed on an existing Pod. For this lab, recreate the Pod using the
updated YAML:

``` powershell
kubectl delete pod emptydir-demo
kubectl apply -f .\emptydir-pod.yaml
```

Remember that deleting the Pod also deletes its `emptyDir` contents.

### `kubectl exec ... cat` says the file does not exist

Check whether the Pod was recreated. A new Pod has a fresh `emptyDir`,
so create the file again if needed.

## 12. Cleanup

When you have finished the lab, delete the Pod:

``` powershell
kubectl delete pod emptydir-demo
```

When you no longer need the entire local lab cluster, delete it:

``` powershell
kind delete cluster --name storage-lab
```

Deleting the cluster removes its Kubernetes resources. It does **not**
delete your local YAML or README files.

Keep `emptydir-pod.yaml` and this `README.md` in your GitHub repository
as your reference.
