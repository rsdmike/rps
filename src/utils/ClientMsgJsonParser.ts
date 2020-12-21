/*********************************************************************
 * Copyright (c) Intel Corporation 2019
 * SPDX-License-Identifier: Apache-2.0
 * Author: Madhavi Losetty
 * Description: Helps to validate the client data
 **********************************************************************/

import { IClientMessageParser } from "../interfaces/IClientMessageParser";
import { ClientMsg, ClientAction, Payload, ClientMethods } from "../RCS.Config";
import { NodeForge } from "../NodeForge";
import { RPSError } from "./RPSError";

export class ClientMsgJsonParser implements IClientMessageParser {
  constructor(
    private nodeForge: NodeForge
  ) { }

  /**
   * @description Parse client message and check for mandatory information
   * @param {WebSocket.Data} message the message coming in over the websocket connection
   * @param {string} clientId Id to keep track of connections
   * @returns {ClientMsg} returns ClientMsg object if client message is valid
   */
  parse(message: string, clientId: string): ClientMsg {
    let msg: ClientMsg = null;
    //Parse and convert the message
    let clientMsg: ClientMsg = JSON.parse(message);
    msg = this.convertClientMsg(clientMsg, clientId);
    return msg;
  }

  /**
   * @description Convert the message received from client to local object ClientMsg
   * @param {ClientMsg} message
   * @param {string} clientId
   * @returns {ClientMsg}
   */
  convertClientMsg(message: ClientMsg, clientId: string): ClientMsg {
    let payload: any = this.nodeForge.decode64(message.payload);
    if (payload) {
      if (message.method !== ClientMethods.RESPONSE) {
        payload = this.parsePayload(payload);
      }
      message.payload = payload;
    } else {
      throw new RPSError(`Missing payload`);
    }
    return message;
  }

  /**
   * @description Convert the payload received from client
   * @param {string} payloadstring
   * @returns {Payload}
   */
  parsePayload(payloadstring: string): Payload{
    let payload: Payload = null;
    try {
      payload = JSON.parse(payloadstring);
    } catch (error) {
      throw new RPSError(`Failed to parse client message payload. ${error.message}`);
    }
    if (payload.client && payload.ver && payload.build && payload.uuid) {
        payload.uuid = this.getUUID(payload.uuid);       
    } else {
      throw new RPSError(`Invalid payload from client`);
    }
    return payload;
  }

  zeroLeftPad(str, len) {
    if (len == null && typeof len != "number") {
      return null;
    }
    if (str == null) str = ""; // If null, this is to generate zero leftpad string
    let zlp = "";
    for (var i = 0; i < len - str.length; i++) {
      zlp += "0";
    }
    return zlp + str;
  }

  getUUID(uuid: any): any {
    uuid = Buffer.from(uuid);
    let guid = [
      this.zeroLeftPad(uuid.readUInt32LE(0).toString(16), 8),
      this.zeroLeftPad(uuid.readUInt16LE(4).toString(16), 4),
      this.zeroLeftPad(uuid.readUInt16LE(6).toString(16), 4),
      this.zeroLeftPad(uuid.readUInt16BE(8).toString(16), 4),
      this.zeroLeftPad(uuid.slice(10).toString("hex").toLowerCase(), 12)].join("-");

    return guid;
  }

}
