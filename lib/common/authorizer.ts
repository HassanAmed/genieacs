
/**
#####################################    File Description    #######################################

This file is implements an Authorization class which have auth functions which are used by Apis in order when requests are
to make sure user making request is authorized to access a resource in db or not.

####################################################################################################
 */

import { PermissionSet, Expression } from "../types";
import { evaluate, or } from "./expression";
/**
 * @description Authorizer class implements methods to enforce and check authorization.
 */
export default class Authorizer {
  private permissionSets: PermissionSet[];
  private validatorCache: WeakMap<
    object,
    (mutationType, mutation, any) => boolean
  >;
  private hasAccessCache: Map<string, boolean>;
  private getFilterCache: Map<string, Expression>;

  public constructor(permissionSets) {
    this.permissionSets = permissionSets;
    this.validatorCache = new WeakMap();
    this.hasAccessCache = new Map();
    this.getFilterCache = new Map();
  }
/**
 * @description Method to check if user is authorized to access resource
 * @param resourceType Resource type
 * @param access Access number
 */
  public hasAccess(resourceType: string, access: number): boolean {
    const cacheKey = `${resourceType}-${access}`;
    if (this.hasAccessCache.has(cacheKey))
      return this.hasAccessCache.get(cacheKey);

    let has = false;
    for (const permissionSet of this.permissionSets) {
      for (const perm of permissionSet) {
        if (perm[resourceType]) {
          if (perm[resourceType].access >= access) {
            has = true;
            break;
          }
        }
      }
    }

    this.hasAccessCache.set(cacheKey, has);
    return has;
  }
/**
 * @description Method to filter resources 
 */
  public getFilter(resourceType: string, access: number): Expression {
    const cacheKey = `${resourceType}-${access}`;
    if (this.getFilterCache.has(cacheKey))
      return this.getFilterCache.get(cacheKey);

    let filter: Expression = null;
    for (const permissionSet of this.permissionSets) {
      for (const perm of permissionSet) {
        if (perm[resourceType]) {
          if (perm[resourceType].access >= access)
            filter = or(filter, perm[resourceType].filter);
        }
      }
    }

    this.getFilterCache.set(cacheKey, filter);
    return filter;
  }
/**
 * @description Check for validators in validator's cache Map
 */
  public getValidator(
    resourceType,
    resource
  ): (mutationType: string, mutation?: any, args?: any) => boolean {
    if (this.validatorCache.has(resource))
      return this.validatorCache.get(resource);

    const validators: Expression[] = [];

    for (const permissionSet of this.permissionSets) {
      for (const perm of permissionSet) {
        if (
          perm[resourceType] &&
          perm[resourceType].access >= 3 &&
          perm[resourceType].validate
        )
          validators.push(perm[resourceType].validate);
      }
    }

    const validator = (
      mutationType: string,
      mutation: any,
      any: any
    ): boolean => {
      if (!validators.length) return false;

      const object = {
        mutationType,
        mutation,
        resourceType,
        object: resource,
        options: any
      };

      const valueFunction = (paramName): any => {
        const entry = paramName.split(".", 1)[0];
        paramName = paramName.slice(entry.length + 1);
        let value = null;
        if (["mutation", "options"].includes(entry)) {
          value = object[entry];
          for (const seg of paramName.split(".")) {
            // typeof null is "object"
            if (value != null && typeof value !== "object") value = null;
            else value = value[seg];
            if (value == null) break;
          }
        } else if (object[entry]) {
          value = object[entry][paramName];
        }

        return value;
      };

      const res = evaluate(
        validators.length > 1 ? ["OR", validators] : validators[0],
        valueFunction,
        Date.now()
      );
      return !Array.isArray(res) && !!res;
    };

    this.validatorCache.set(resource, validator);
    return validator;
  }
// Get current permission set
  public getPermissionSets(): PermissionSet[] {
    return this.permissionSets;
  }
}
