# Remote Provisioning Server

The Remote Provisioning Server (RPS) enables the configuration and activation of Intel® AMT devices based on a defined profile. RPS utilizes the [Remote Provision Client (RPC)](https://github.com/open-amt-cloud-toolkit/rps) deployed onto edge devices to connect the devices to the [Management Presence Server (MPS)](https://github.com/open-amt-cloud-toolkit/mps) and enable remote manageability features.


**For detailed documentation** about Getting Started with RPS or other features of the Open AMT Cloud Toolkit, see the [docs](https://open-amt-cloud-toolkit.github.io/docs/).

## Prerequisites

To succesfully deploy RPS, the following software must be installed on your development system:

- [Node.js* LTS 12.x.x or newer](https://nodejs.org/en/)
- [git](https://git-scm.com/downloads)
- [Management Presense Server](https://github.com/open-amt-cloud-toolkit/mps)


## Deploy the Remote Provisioning Server (RPS) Microservice

To deploy the RPS on a local development system: 

1. For a local setup, RPS requires an [installed MPS](https://github.com/open-amt-cloud-toolkit/mps) in the same parent directory. Clone the RPS repository to the same parent directory where your mps directory is located. 

    ```
    📦parent
     ┣ 📂mps
     ┗ 📂rps
    ```

    ```
    git clone https://github.com/open-amt-cloud-toolkit/rps.git && cd rps
    ```

2. Run 'npm install' from the working rps directory.

    ``` bash
    npm install
    ```

3. Run 'npm run dev' start command. The npm run dev start command may take 1-2 minutes to install.

    ``` bash
    npm run dev
    ```
    
    >Note: Warning messages are okay and expected for optional dependencies.

4. The RPS listens on port 8081. Successful installation produces the command line message:

    ```
    WebSocketListener - RPS Microservice socket listening on port: 8080 ...!
    RPS Microservice Rest APIs listening on https://:8081.
    ```
    
For detailed documentation about RPS, see the [docs](https://open-amt-cloud-toolkit.github.io/docs/)
