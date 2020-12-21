/*********************************************************************
 * Copyright (c) Intel Corporation 2020
 * SPDX-License-Identifier: Apache-2.0
 * Description: Activate AMT in client control mode
 * Author : Madhavi Losetty
 **********************************************************************/

import { IExecutor } from "../interfaces/IExecutor";
import { ILogger } from "../interfaces/ILogger";
import { ClientMsg, mpsServer, ClientObject, CIRAConfig } from "../RCS.Config";
import { ClientResponseMsg } from "../utils/ClientResponseMsg";
import { WSManProcessor } from "../WSManProcessor";
import { IClientManager } from "../interfaces/IClientManager";
import { RPSError } from "../utils/RPSError";
import { mpsserver } from "../utils/constants"
import { IConfigurator } from "../interfaces/IConfigurator";

export class CIRAConfigurator implements IExecutor {
    constructor(
        private logger: ILogger,
        private configurator: IConfigurator,
        private responseMsg: ClientResponseMsg,
        private amtwsman: WSManProcessor,
        private clientManager: IClientManager
    ) { }

    /**
     * @description configure CIRA
     * @param {any} message valid client message
     * @param {string} clientId Id to keep track of connections
     * @returns {ClientMsg} message to sent to client
     */
    async execute(message: any, clientId: string): Promise<ClientMsg> {
        let clientObj;
        try {
            clientObj = this.clientManager.getClientObject(clientId);
            let wsmanResponse = message.payload;
            if (wsmanResponse) {
                await this.delete(clientId, clientObj, wsmanResponse);

                if (clientObj.ClientData.payload.profile.CIRAConfigName && clientObj.ciraconfig.setENVSettingData) {
                    // Add trusted root certificate and MPS server
                    if (clientObj.ciraconfig.mpsRemoteSAP_Delete && !clientObj.ciraconfig.addTrustedRootCert) {
                        clientObj.ciraconfig.addTrustedRootCert = true;
                        this.clientManager.setClientObject(clientObj);
                        let configScript: CIRAConfig = clientObj.ClientData.payload.profile.CIRAConfigObject;
                        await this.amtwsman.execute(clientId, `AMT_PublicKeyManagementService`, `AddTrustedRootCertificate`, { CertificateBlob: configScript.MPSRootCertificate }, null, `admin`, clientObj.ClientData.payload.uuid);
                    } else if (clientObj.ciraconfig.addTrustedRootCert && !clientObj.ciraconfig.addMPSServer) {
                        this.logger.debug(`${clientObj.uuid}  Adding trusted root certificate.`);
                        clientObj.ciraconfig.addMPSServer = true;
                        this.clientManager.setClientObject(clientObj);
                        let configScript: CIRAConfig = clientObj.ClientData.payload.profile.CIRAConfigObject;
                        let server: mpsServer = {
                            AccessInfo: configScript.MPSServerAddress,
                            InfoFormat: configScript.ServerAddressFormat,
                            Port: configScript.MPSPort,
                            AuthMethod: configScript.AuthMethod,
                            Username: configScript.Username,
                            Password: configScript.Password
                        }
                        if (configScript.ServerAddressFormat === 3 && configScript.CommonName) {
                            server.CN = configScript.CommonName;
                        }
                        await this.amtwsman.execute(clientId, `AMT_RemoteAccessService`, `AddMpServer`, server, null, `admin`, clientObj.ClientData.payload.uuid);
                    } else if (clientObj.ciraconfig.addMPSServer && !clientObj.ciraconfig.mpsRemoteSAP) {
                        clientObj.ciraconfig.mpsRemoteSAP = true;
                        this.clientManager.setClientObject(clientObj);
                        if (wsmanResponse.Body && wsmanResponse.Body.ReturnValueStr === 'SUCCESS') {
                            this.logger.debug(`${clientObj.uuid}  Management Presence Server (MPS) successfully added.`);
                            await this.amtwsman.batchEnum(clientId, "AMT_ManagementPresenceRemoteSAP", `admin`, clientObj.ClientData.payload.uuid);
                        }else {
                            throw new RPSError(`Device ${clientObj.uuid} ${clientObj.ciraconfig.status} Failed to add Management Presence Server.`);
                        }
                    } else if (!clientObj.ciraconfig.addRemoteAccessPolicyRule && clientObj.ciraconfig.addMPSServer) {
                        let result = wsmanResponse.AMT_ManagementPresenceRemoteSAP
                        clientObj.ciraconfig.addRemoteAccessPolicyRule = true;
                        this.clientManager.setClientObject(clientObj);
                        if (result && result.responses && result.responses.length > 0) {
                            //TBD: Check when there are more than one MPS added to system.
                            let name = wsmanResponse.AMT_ManagementPresenceRemoteSAP.responses[0].Name;
                            this.logger.debug(`${clientObj.uuid} : Management Presence Server (MPS) exists.`);
                            let policy = {
                                Trigger: 2, //2 – Periodic
                                TunnelLifeTime: 0, //0 means that the tunnel should stay open until it is closed
                                ExtendedData: `AAAAAAAAABk=`, // Equals to 25 seconds in base 64 with network order. 
                                MpServer: mpsserver(name)
                            };
                            await this.amtwsman.execute(clientId, `AMT_RemoteAccessService`, `AddRemoteAccessPolicyRule`, policy, null, `admin`, clientObj.ClientData.payload.uuid);
                        } else {
                            throw new RPSError(`Device ${clientObj.uuid} ${clientObj.ciraconfig.status} Failed to add Management Presence Server.`);
                        }
                    } else if (!clientObj.ciraconfig.userInitConnectionService && clientObj.ciraconfig.addRemoteAccessPolicyRule) {
                        clientObj.ciraconfig.userInitConnectionService = true;
                        this.clientManager.setClientObject(clientObj);
                        await this.amtwsman.execute(clientId, `AMT_UserInitiatedConnectionService`, `RequestStateChange`, { RequestedState: 32771 }, null, `admin`, clientObj.ClientData.payload.uuid);
                    } else if (clientObj.ciraconfig.userInitConnectionService && !clientObj.ciraconfig.getENVSettingData_CIRA) {
                        clientObj.ciraconfig.getENVSettingData_CIRA = true;
                        this.clientManager.setClientObject(clientObj);
                        await this.amtwsman.batchEnum(clientId, "*AMT_EnvironmentDetectionSettingData", `admin`, clientObj.ClientData.payload.uuid);
                    } else if (clientObj.ciraconfig.getENVSettingData && !clientObj.ciraconfig.setENVSettingData_CIRA) {
                        let envSettings = wsmanResponse.AMT_EnvironmentDetectionSettingData.response;
                        this.logger.info(`Environment settings : ${JSON.stringify(envSettings, null, "\t")}`)
                        if (envSettings.DetectionStrings === undefined) {
                            envSettings.DetectionStrings = "dummy.com"
                        } else if (envSettings.DetectionStrings !== "dummy.com") {
                            envSettings.DetectionStrings = "dummy.com"
                        }
                        clientObj.ciraconfig.setENVSettingData_CIRA = true;
                        this.clientManager.setClientObject(clientObj);
                        await this.amtwsman.put(clientId, 'AMT_EnvironmentDetectionSettingData', envSettings, 'admin', clientObj.ClientData.payload.uuid);
                    } else if (clientObj.ciraconfig.setENVSettingData_CIRA) {
                        return this.responseMsg.get(clientId, null, "success", "success", `Device ${clientObj.uuid} ${clientObj.ciraconfig.status} CIRA Configured.`);
                    }
                } else if (clientObj.ciraconfig.setENVSettingData) {
                    this.logger.debug(`test message`)
                    return this.responseMsg.get(clientId, null, "success", "success", `Device ${clientObj.uuid} ${clientObj.ciraconfig.status}`);
                }
            }
        } catch (error) {
            this.logger.error(`${clientId} : Failed to configure CIRA : ${error}`);
            if (error instanceof RPSError) {
                return this.responseMsg.get(clientId, null, "error", "failed", error.message);
            } else {
                return this.responseMsg.get(clientId, null, "error", "failed", `${clientObj.ciraconfig.status} Failed to configure CIRA `);
            }
        }
    }

    /**
     * @description Delete existing CIRA configurations
     * @param {string} clientId Id to keep track of connections
     * @param {clientObj} ClientObject keep track of client info and status
     * @param {any} wsmanResponse valid client message
     */
    async delete(clientId: string, clientObj: ClientObject, wsmanResponse: any) {
    
        if (!clientObj.ciraconfig.policyRuleUserInitiate) {
            this.logger.debug(`Deleting CIRA Configuration for device ${clientObj.ClientData.payload.uuid}`);
            // Updates the CIRA Channel with admin and device password
            if (this.amtwsman.cache[clientId]) {
                this.amtwsman.cache[clientId].wsman.comm.setupCommunication.getUsername = () => { return `admin` }
                this.amtwsman.cache[clientId].wsman.comm.setupCommunication.getPassword = () => { return clientObj.ClientData.payload.password }
            }
            await this.setAMTPassword(clientId, clientObj);
            clientObj = this.clientManager.getClientObject(clientId);
            clientObj.ciraconfig.policyRuleUserInitiate = true;
            this.clientManager.setClientObject(clientObj);
            await this.amtwsman.delete(clientId, 'AMT_RemoteAccessPolicyRule', { PolicyRuleName: "User Initiated" }, `admin`, clientObj.ClientData.payload.password);
        } else if (!clientObj.ciraconfig.policyRuleAlert) {
            clientObj.ciraconfig.policyRuleAlert = true;
            this.clientManager.setClientObject(clientObj);
            await this.amtwsman.delete(clientId, 'AMT_RemoteAccessPolicyRule', { PolicyRuleName: "Alert" }, `admin`);
        } else if (!clientObj.ciraconfig.policyRulePeriodic) {
            clientObj.ciraconfig.policyRulePeriodic = true;
            this.clientManager.setClientObject(clientObj);
            await this.amtwsman.delete(clientId, 'AMT_RemoteAccessPolicyRule', { PolicyRuleName: "Periodic" }, `admin`);
        } else if (!clientObj.ciraconfig.mpsRemoteSAP_Enumerate) {
            this.logger.debug(`${clientObj.uuid}: All policies are removed successfully.`);
            clientObj.ciraconfig.mpsRemoteSAP_Enumerate = true;
            this.clientManager.setClientObject(clientObj);
            await this.amtwsman.batchEnum(clientId, "AMT_ManagementPresenceRemoteSAP");
        } else if (!clientObj.ciraconfig.mpsRemoteSAP_Delete && wsmanResponse.AMT_ManagementPresenceRemoteSAP) {
            clientObj.ciraconfig.mpsRemoteSAP_Delete = true;
            this.clientManager.setClientObject(clientObj);
            let selector: any;
            if (wsmanResponse.AMT_ManagementPresenceRemoteSAP.responses.length > 0) {
                let name = wsmanResponse.AMT_ManagementPresenceRemoteSAP.responses[0].Name;
                selector = { Name: name }
                this.logger.debug(`MPS Name : ${name},  selector : ${JSON.stringify(selector, null, "\t")}`);
                await this.amtwsman.delete(clientId, 'AMT_ManagementPresenceRemoteSAP', selector, `admin`);
                return;
            }
            clientObj = this.clientManager.getClientObject(clientId);
        }
        // Deletes all the public certificates if exists
        if (clientObj.ciraconfig.mpsRemoteSAP_Delete && !clientObj.ciraconfig.mpsRemoteSAP_Get) {
            clientObj.ciraconfig.mpsRemoteSAP_Get = true;
            this.clientManager.setClientObject(clientObj);
            await this.amtwsman.batchEnum(clientId, "AMT_PublicKeyCertificate");
        } else if (clientObj.ciraconfig.mpsRemoteSAP_Get && !clientObj.ciraconfig.mpsPublicCert_Delete) {
            if (clientObj.ciraconfig.publicCerts === undefined) {
                clientObj.ciraconfig.publicCerts = wsmanResponse.AMT_PublicKeyCertificate.responses;
            }
            if (clientObj.ciraconfig.publicCerts.length > 0) {
                let cert = clientObj.ciraconfig.publicCerts[clientObj.ciraconfig.publicCerts.length - 1];
                clientObj.ciraconfig.publicCerts.pop();
                await this.amtwsman.delete(clientId, 'AMT_PublicKeyCertificate', cert, `admin`);
            } else {
                clientObj.ciraconfig.mpsPublicCert_Delete = true;
            }
            this.clientManager.setClientObject(clientObj);
        }
        //Max five domain suffix can be added. Deletes all the domain suffixes for now.
        if (clientObj.ciraconfig.mpsPublicCert_Delete && !clientObj.ciraconfig.getENVSettingData) {
            clientObj.ciraconfig.getENVSettingData = true;
            this.clientManager.setClientObject(clientObj);
            await this.amtwsman.batchEnum(clientId, "*AMT_EnvironmentDetectionSettingData", `admin`);
        } else if (clientObj.ciraconfig.getENVSettingData && !clientObj.ciraconfig.setENVSettingData) {
            if (wsmanResponse.AMT_EnvironmentDetectionSettingData &&
                wsmanResponse.AMT_EnvironmentDetectionSettingData.response &&
                wsmanResponse.AMT_EnvironmentDetectionSettingData.response.DetectionStrings !== undefined) {
                let envSettings = wsmanResponse.AMT_EnvironmentDetectionSettingData.response;
                envSettings.DetectionStrings = [];
                await this.amtwsman.put(clientId, 'AMT_EnvironmentDetectionSettingData', envSettings, 'admin');
            } else {
                clientObj.ciraconfig.setENVSettingData = true;
                this.clientManager.setClientObject(clientObj);
                this.logger.debug(`${clientObj.uuid} Deleted existing CIRA Configuration.`);
                clientObj = this.clientManager.getClientObject(clientId);
            }
        }
    }


    async setAMTPassword(clientId: string, clientObj: ClientObject) {
        let payload = clientObj.ClientData.payload;
        //get the Device password
        let amtDevice;
        if (this.configurator && this.configurator.amtDeviceRepository) {
            amtDevice = await this.configurator.amtDeviceRepository.get(payload.uuid);
            if (amtDevice && amtDevice.amtpass) {
                payload.password = amtDevice.amtpass;
                clientObj.ClientData.payload = payload;
                this.clientManager.setClientObject(clientObj);
                this.logger.info(`amt password found for Device ${payload.uuid}`);
            } else {
                this.logger.error(`amt password DOES NOT exists for Device ${payload.uuid}`);
                throw new RPSError(`amt password DOES NOT exists for Device ${payload.uuid}`);
            }
        } else {
            this.logger.error(`Device ${payload.uuid} amtDeviceRepository not found`);
            throw new RPSError(`Device ${payload.uuid} amtDeviceRepository not found`);
        }
    }
}

