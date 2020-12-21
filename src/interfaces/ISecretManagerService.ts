/*********************************************************************
 * Copyright (c) Intel Corporation 2019
 * SPDX-License-Identifier: Apache-2.0
 * Description: stores amt profiles
 * Author: Ramu Bachala
 **********************************************************************/

export interface ISecretManagerService {
  getSecretFromKey(path: string, key: string) : Promise<string>;
  listSecretsAtPath(path: string) : Promise<any>;
  readJsonFromKey(path: string, key: string) : Promise<string>;
  writeSecretWithKey(path: string, key:string, keyvalue: any) : Promise<void>;
  deleteSecretWithKey(path: string, key:string) : Promise<void>;
}
