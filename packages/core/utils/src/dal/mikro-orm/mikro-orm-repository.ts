import {
  Context,
  DAL,
  FilterQuery,
  FindOptions,
  InferEntityType,
  InferRepositoryReturnType,
  FilterQuery as InternalFilterQuery,
  PerformedActions,
  RepositoryService,
  RepositoryTransformOptions,
  UpsertWithReplaceConfig,
} from "@medusajs/types"
import {
  EntityClass,
  EntityManager,
  EntityName,
  EntityProperty,
  EntitySchema,
  LoadStrategy,
  FilterQuery as MikroFilterQuery,
  FindOptions as MikroOptions,
  ReferenceKind,
} from "@mikro-orm/core"
import { SqlEntityManager } from "@mikro-orm/postgresql"
import {
  arrayDifference,
  isString,
  MedusaError,
  promiseAll,
} from "../../common"
import { toMikroORMEntity } from "../../dml"
import { buildQuery } from "../../modules-sdk/build-query"
import { transactionWrapper } from "../utils"
import { dbErrorMapper } from "./db-error-mapper"
import { mikroOrmSerializer } from "./mikro-orm-serializer"
import { mikroOrmUpdateDeletedAtRecursively } from "./utils"

export class MikroOrmBase {
  readonly manager_: any

  protected constructor({ manager }) {
    this.manager_ = manager
  }

  getFreshManager<TManager = unknown>(): TManager {
    return (this.manager_.fork
      ? this.manager_.fork()
      : this.manager_) as unknown as TManager
  }

  getActiveManager<TManager = unknown>({
    transactionManager,
    manager,
  }: Context = {}): TManager {
    return (transactionManager ?? manager ?? this.getFreshManager()) as TManager
  }

  async transaction<TManager = unknown>(
    task: (transactionManager: TManager) => Promise<any>,
    options: {
      isolationLevel?: string
      enableNestedTransactions?: boolean
      transaction?: TManager
    } = {}
  ): Promise<any> {
    const freshManager = this.getFreshManager
      ? this.getFreshManager()
      : this.manager_

    return await transactionWrapper(freshManager, task, options).catch(
      dbErrorMapper
    )
  }

  async serialize<TOutput extends object | object[]>(
    data: any,
    options?: any
  ): Promise<TOutput> {
    return await mikroOrmSerializer<TOutput>(data, options)
  }
}

/**
 * Privileged extends of the abstract classes unless most of the methods can't be implemented
 * in your repository. This base repository is also used to provide a base repository
 * injection if needed to be able to use the common methods without being related to an entity.
 * In this case, none of the method will be implemented except the manager and transaction
 * related ones.
 */

export class MikroOrmBaseRepository<const T extends object = object>
  extends MikroOrmBase
  implements RepositoryService<T>
{
  entity: EntityClass<InferEntityType<T>>

  constructor(...args: any[]) {
    // @ts-ignore
    super(...arguments)
  }

  static buildUniqueCompositeKeyValue(keys: string[], data: object) {
    return keys.map((k) => data[k]).join("_")
  }

  static retrievePrimaryKeys(entity: EntityClass<any> | EntitySchema) {
    return (
      (entity as EntitySchema).meta?.primaryKeys ??
      (entity as EntityClass<any>).prototype.__meta.primaryKeys ?? ["id"]
    )
  }

  /**
   * When using the select-in strategy, the populated fields are not selected by default unlike when using the joined strategy.
   * This method will add the populated fields to the fields array if they are not already specifically selected.
   *
   * TODO: Revisit if this is still needed in v6 as it seems to be a workaround for a bug in v5
   *
   * @param {FindOptions<any>} findOptions
   */
  static compensateRelationFieldsSelectionFromLoadStrategy({
    findOptions,
  }: {
    findOptions: DAL.FindOptions
  }) {
    const loadStrategy = findOptions?.options?.strategy

    if (loadStrategy !== LoadStrategy.SELECT_IN) {
      return
    }

    findOptions.options ??= {}
    const populate = findOptions.options.populate ?? []
    const fields = findOptions.options.fields ?? []
    populate.forEach((populateRelation: string) => {
      if (
        fields.some((field: string) => field.startsWith(populateRelation + "."))
      ) {
        return
      }

      // If there is no specific fields selected for the relation but the relation is populated, we select all fields
      fields.push(populateRelation + ".*")
    })
  }

  create(
    data: unknown[],
    context?: Context
  ): Promise<InferRepositoryReturnType<T>[]> {
    throw new Error("Method not implemented.")
  }

  update(
    data: { entity; update }[],
    context?: Context
  ): Promise<InferRepositoryReturnType<T>[]> {
    throw new Error("Method not implemented.")
  }

  delete(
    idsOrPKs: FindOptions<T>["where"],
    context?: Context
  ): Promise<string[]> {
    throw new Error("Method not implemented.")
  }

  find(
    options?: DAL.FindOptions<T>,
    context?: Context
  ): Promise<InferRepositoryReturnType<T>[]> {
    throw new Error("Method not implemented.")
  }

  findAndCount(
    options?: DAL.FindOptions<T>,
    context?: Context
  ): Promise<[InferRepositoryReturnType<T>[], number]> {
    throw new Error("Method not implemented.")
  }

  upsert(
    data: unknown[],
    context: Context = {}
  ): Promise<InferRepositoryReturnType<T>[]> {
    throw new Error("Method not implemented.")
  }

  upsertWithReplace(
    data: unknown[],
    config: UpsertWithReplaceConfig<InferRepositoryReturnType<T>> = {
      relations: [],
    },
    context: Context = {}
  ): Promise<{
    entities: InferRepositoryReturnType<T>[]
    performedActions: PerformedActions
  }> {
    throw new Error("Method not implemented.")
  }

  async softDelete(
    filters:
      | string
      | string[]
      | DAL.FindOptions<T>["where"]
      | DAL.FindOptions<T>["where"][],
    sharedContext: Context = {}
  ): Promise<[InferRepositoryReturnType<T>[], Record<string, unknown[]>]> {
    const entities = await this.find({ where: filters as any }, sharedContext)
    const date = new Date()

    const manager = this.getActiveManager<SqlEntityManager>(sharedContext)
    const softDeletedEntitiesMap = await mikroOrmUpdateDeletedAtRecursively<T>(
      manager,
      entities as any[],
      date
    )

    return [entities, Object.fromEntries(softDeletedEntitiesMap)]
  }

  async restore(
    idsOrFilter: string[] | InternalFilterQuery,
    sharedContext: Context = {}
  ): Promise<[InferRepositoryReturnType<T>[], Record<string, unknown[]>]> {
    const query = buildQuery<T>(idsOrFilter, {
      withDeleted: true,
    })

    const entities = await this.find(query, sharedContext)

    const manager = this.getActiveManager<SqlEntityManager>(sharedContext)
    const softDeletedEntitiesMap = await mikroOrmUpdateDeletedAtRecursively(
      manager,
      entities as any[],
      null
    )

    return [entities, Object.fromEntries(softDeletedEntitiesMap)]
  }
}

export class MikroOrmBaseTreeRepository<
  const T extends object = object
> extends MikroOrmBase {
  constructor() {
    // @ts-ignore
    super(...arguments)
  }

  find(
    options?: DAL.FindOptions,
    transformOptions?: RepositoryTransformOptions,
    context?: Context
  ): Promise<InferRepositoryReturnType<T>[]> {
    throw new Error("Method not implemented.")
  }

  findAndCount(
    options?: DAL.FindOptions,
    transformOptions?: RepositoryTransformOptions,
    context?: Context
  ): Promise<[InferRepositoryReturnType<T>[], number]> {
    throw new Error("Method not implemented.")
  }

  create(
    data: unknown[],
    context?: Context
  ): Promise<InferRepositoryReturnType<T>[]> {
    throw new Error("Method not implemented.")
  }

  update(
    data: unknown[],
    context?: Context
  ): Promise<InferRepositoryReturnType<T>[]> {
    throw new Error("Method not implemented.")
  }

  delete(ids: string[], context?: Context): Promise<string[]> {
    throw new Error("Method not implemented.")
  }
}

export function mikroOrmBaseRepositoryFactory<const T extends object>(
  entity: T
): {
  new ({ manager }: { manager: any }): MikroOrmBaseRepository<T>
} {
  const mikroOrmEntity = toMikroORMEntity(entity) as EntityClass<
    InferEntityType<T>
  >

  class MikroOrmAbstractBaseRepository_ extends MikroOrmBaseRepository<T> {
    entity = mikroOrmEntity
    tableName = (
      (mikroOrmEntity as unknown as EntitySchema).meta ??
      (mikroOrmEntity as EntityClass<any>).prototype.__meta
    ).collection

    // @ts-ignore
    constructor(...args: any[]) {
      // @ts-ignore
      super(...arguments)

      return new Proxy(this, {
        get: (target, prop) => {
          if (typeof target[prop] === "function") {
            return (...args) => {
              const res = target[prop].bind(target)(...args)
              if (res instanceof Promise) {
                return res.catch(dbErrorMapper)
              }

              return res
            }
          }

          return target[prop]
        },
      })
    }

    async create(
      data: any[],
      context?: Context
    ): Promise<InferRepositoryReturnType<T>[]> {
      const manager = this.getActiveManager<EntityManager>(context)

      const entities = data.map((data_) => {
        return manager.create(this.entity, data_)
      })

      manager.persist(entities)

      return entities as InferRepositoryReturnType<T>[]
    }

    /**
     * On a many to many relation, we expect to detach all the pivot items in case an empty array is provided.
     * In that case, this relation needs to be init as well as its counter part in order to be
     * able to perform the removal action.
     *
     * This action performs the initialization in the provided entity and therefore mutate in place.
     *
     * @param {{entity, update}[]} data
     * @param context
     * @private
     */
    private async initManyToManyToDetachAllItemsIfNeeded(
      data: { entity; update }[],
      context?: Context
    ) {
      const manager = this.getActiveManager<EntityManager>(context)

      const relations = manager
        .getDriver()
        .getMetadata()
        .get(this.entity.name).relations

      // In case an empty array is provided for a collection relation of type m:n, this relation needs to be init in order to be
      // able to perform an application cascade action.
      const collectionsToRemoveAllFrom: Map<
        string,
        { name: string; mappedBy?: string }
      > = new Map()
      data.forEach(({ update }) =>
        Object.keys(update).filter((key) => {
          const relation = relations.find((relation) => relation.name === key)
          const shouldInit =
            relation &&
            relation.kind === ReferenceKind.MANY_TO_MANY &&
            Array.isArray(update[key]) &&
            !update[key].length

          if (shouldInit) {
            collectionsToRemoveAllFrom.set(key, {
              name: key,
              mappedBy: relations.find((r) => r.name === key)?.mappedBy,
            })
          }
        })
      )

      for (const [
        collectionToRemoveAllFrom,
        descriptor,
      ] of collectionsToRemoveAllFrom) {
        await promiseAll(
          data.flatMap(async ({ entity }) => {
            if (!descriptor.mappedBy) {
              return await entity[collectionToRemoveAllFrom].init()
            }

            const promises: Promise<any>[] = []
            await entity[collectionToRemoveAllFrom].init()
            const items = entity[collectionToRemoveAllFrom]

            for (const item of items) {
              promises.push(item[descriptor.mappedBy!].init())
            }

            return promises
          })
        )
      }
    }

    async update(
      data: { entity: any; update: any }[],
      context?: Context
    ): Promise<InferRepositoryReturnType<T>[]> {
      const manager = this.getActiveManager<EntityManager>(context)

      await this.initManyToManyToDetachAllItemsIfNeeded(data, context)

      data.forEach(({ entity, update }) => {
        manager.assign(entity, update, {
          mergeObjectProperties: true,
        })
        manager.persist(entity)
      })

      return data.map((d) => d.entity) as InferRepositoryReturnType<T>[]
    }

    async delete(
      filters: FindOptions<T>["where"],
      context?: Context
    ): Promise<string[]> {
      const manager = this.getActiveManager<SqlEntityManager>(context)

      const whereSqlInfo = manager
        .createQueryBuilder(this.entity.name, this.tableName)
        .where(filters)
        .getKnexQuery()
        .toSQL()

      const where = [
        whereSqlInfo.sql.split("where ")[1],
        whereSqlInfo.bindings,
      ] as [string, any[]]

      return await (manager.getTransactionContext() ?? manager.getKnex())
        .queryBuilder()
        .from(this.tableName)
        .delete()
        .where(manager.getKnex().raw(...where))
        .returning("id")
        .then((rows: { id: string }[]) => {
          return rows.map((row: { id: string }) => row.id)
        })
    }

    async find(
      options: DAL.FindOptions<T> = { where: {} } as DAL.FindOptions<T>,
      context?: Context
    ): Promise<InferRepositoryReturnType<T>[]> {
      const manager = this.getActiveManager<EntityManager>(context)

      const findOptions_ = { ...options }
      findOptions_.options ??= {}

      if (!("strategy" in findOptions_.options)) {
        if (findOptions_.options.limit != null || findOptions_.options.offset) {
          Object.assign(findOptions_.options, {
            strategy: LoadStrategy.SELECT_IN,
          })
        } else {
          Object.assign(findOptions_.options, {
            strategy: LoadStrategy.JOINED,
          })
        }
      }

      MikroOrmBaseRepository.compensateRelationFieldsSelectionFromLoadStrategy({
        findOptions: findOptions_,
      })

      return (await manager.find(
        this.entity as EntityName<T>,
        findOptions_.where as MikroFilterQuery<T>,
        findOptions_.options as MikroOptions<T>
      )) as InferRepositoryReturnType<T>[]
    }

    async findAndCount(
      findOptions: DAL.FindOptions<T> = { where: {} } as DAL.FindOptions<T>,
      context: Context = {}
    ): Promise<[InferRepositoryReturnType<T>[], number]> {
      const manager = this.getActiveManager<EntityManager>(context)

      const findOptions_ = { ...findOptions }
      findOptions_.options ??= {}

      Object.assign(findOptions_.options, {
        strategy: LoadStrategy.SELECT_IN,
      })

      MikroOrmBaseRepository.compensateRelationFieldsSelectionFromLoadStrategy({
        findOptions: findOptions_,
      })

      return (await manager.findAndCount(
        this.entity,
        findOptions_.where,
        findOptions_.options as any // MikroOptions<T>
      )) as [InferRepositoryReturnType<T>[], number]
    }

    async upsert(
      data: any[],
      context: Context = {}
    ): Promise<InferRepositoryReturnType<T>[]> {
      const manager = this.getActiveManager<EntityManager>(context)

      const primaryKeys = MikroOrmAbstractBaseRepository_.retrievePrimaryKeys(
        this.entity
      )

      let primaryKeysCriteria: { [key: string]: any }[] = []
      if (primaryKeys.length === 1) {
        const primaryKeyValues = data
          .map((d) => d[primaryKeys[0]])
          .filter(Boolean)

        if (primaryKeyValues.length) {
          primaryKeysCriteria.push({
            [primaryKeys[0]]: primaryKeyValues,
          })
        }
      } else {
        primaryKeysCriteria = data.map((d) => ({
          $and: primaryKeys.map((key) => ({ [key]: d[key] })),
        }))
      }

      let allEntities: InferRepositoryReturnType<T>[][] = []

      if (primaryKeysCriteria.length) {
        allEntities = await Promise.all(
          primaryKeysCriteria.map(
            async (criteria) =>
              await this.find(
                { where: criteria } as DAL.FindOptions<T>,
                context
              )
          )
        )
      }

      const existingEntities = allEntities.flat()

      const existingEntitiesMap = new Map<
        string,
        InferRepositoryReturnType<T>
      >()
      existingEntities.forEach((entity) => {
        if (entity) {
          const key =
            MikroOrmAbstractBaseRepository_.buildUniqueCompositeKeyValue(
              primaryKeys,
              entity
            )
          existingEntitiesMap.set(key, entity)
        }
      })

      const upsertedEntities: InferRepositoryReturnType<T>[] = []
      const createdEntities: InferRepositoryReturnType<T>[] = []
      const updatedEntities: InferRepositoryReturnType<T>[] = []

      data.forEach((data_) => {
        // In case the data provided are just strings, then we build an object with the primary key as the key and the data as the valuecd -
        const key =
          MikroOrmAbstractBaseRepository_.buildUniqueCompositeKeyValue(
            primaryKeys,
            data_
          )

        const existingEntity = existingEntitiesMap.get(key)
        if (existingEntity) {
          const updatedType = manager.assign(existingEntity, data_)
          updatedEntities.push(updatedType as any)
        } else {
          const newEntity = manager.create(this.entity, data_)
          createdEntities.push(newEntity as InferRepositoryReturnType<T>)
        }
      })

      if (createdEntities.length) {
        manager.persist(createdEntities)
        upsertedEntities.push(...createdEntities)
      }

      if (updatedEntities.length) {
        manager.persist(updatedEntities)
        upsertedEntities.push(...updatedEntities)
      }

      // TODO return the all, created, updated entities
      return upsertedEntities as InferRepositoryReturnType<T>[]
    }

    // UpsertWithReplace does several things to simplify module implementation.
    // For each entry of your base entity, it will go through all one-to-many and many-to-many relations, and it will do a diff between what is passed and what is in the database.
    // For each relation, it create new entries (without an ID), it will associate existing entries (with only an ID), and it will update existing entries (with an ID and other fields).
    // Finally, it will delete the relation entries that were omitted in the new data.
    // The response is a POJO of the data that was written to the DB, including all new IDs. The order is preserved with the input.
    // Limitations: We expect that IDs are used as primary keys, and we don't support composite keys.
    // We only support 1-level depth of upserts. We don't support custom fields on the many-to-many pivot tables for now
    async upsertWithReplace(
      data: any[],
      config: UpsertWithReplaceConfig<InferRepositoryReturnType<T>> = {
        relations: [],
      },
      context: Context = {}
    ): Promise<{
      entities: InferRepositoryReturnType<T>[]
      performedActions: PerformedActions
    }> {
      const performedActions: PerformedActions = {
        created: {},
        updated: {},
        deleted: {},
      }

      if (!data.length) {
        return { entities: [], performedActions }
      }

      // We want to convert a potential ORM model to a POJO
      const normalizedData: any[] = await this.serialize(data)

      const manager = this.getActiveManager<SqlEntityManager>(context)
      // Handle the relations
      const allRelations = manager
        .getDriver()
        .getMetadata()
        .get(this.entity.name).relations

      const nonexistentRelations = arrayDifference(
        (config.relations as any) ?? [],
        allRelations.map((r) => r.name)
      )

      if (nonexistentRelations.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Nonexistent relations were passed during upsert: ${nonexistentRelations}`
        )
      }

      // We want to response with all the data including the IDs in the same order as the input. We also include data that was passed but not processed.
      const reconstructedResponse: any[] = []
      const originalDataMap = new Map<string, T>()

      // Create only the top-level entity without the relations first
      const toUpsert = normalizedData.map((entry) => {
        // Make a copy of the data and remove undefined fields. The data is already a POJO due to the serialization above
        const entryCopy = JSON.parse(JSON.stringify(entry))
        const reconstructedEntry: any = {}

        allRelations?.forEach((relation) => {
          reconstructedEntry[relation.name] = this.handleRelationAssignment_(
            relation,
            entryCopy
          )
        })

        const mainEntity = this.getEntityWithId(
          manager,
          this.entity.name,
          entryCopy
        )
        reconstructedResponse.push({ ...mainEntity, ...reconstructedEntry })
        originalDataMap.set(mainEntity.id, entry)

        return mainEntity
      })

      let {
        orderedEntities: upsertedTopLevelEntities,
        performedActions: performedActions_,
      } = await this.upsertMany_(manager, this.entity.name, toUpsert)

      this.mergePerformedActions(performedActions, performedActions_)

      await promiseAll(
        upsertedTopLevelEntities
          .map((entityEntry, i) => {
            const originalEntry = originalDataMap.get((entityEntry as any).id)!
            const reconstructedEntry = reconstructedResponse[i]

            return allRelations?.map(async (relation) => {
              const relationName = relation.name as keyof T
              if (!config.relations?.includes(relationName)) {
                return
              }

              // TODO: Handle ONE_TO_ONE
              // One to one and Many to one are handled outside of the assignment as they need to happen before the main entity is created
              if (
                relation.kind === ReferenceKind.ONE_TO_ONE ||
                relation.kind === ReferenceKind.MANY_TO_ONE
              ) {
                return
              }

              const { entities, performedActions: performedActions_ } =
                await this.assignCollectionRelation_(
                  manager,
                  { ...originalEntry, id: (entityEntry as any).id },
                  relation
                )

              this.mergePerformedActions(performedActions, performedActions_)
              reconstructedEntry[relationName] = entities
              return
            })
          })
          .flat()
      )

      // // We want to populate the identity map with the data that was written to the DB, and return an entity object
      // return reconstructedResponse.map((r) =>
      //   manager.create(entity, r, { persist: false })
      // )

      return { entities: reconstructedResponse, performedActions }
    }

    private mergePerformedActions(
      performedActions: PerformedActions,
      newPerformedActions: PerformedActions
    ) {
      Object.entries(newPerformedActions).forEach(([action, entities]) => {
        Object.entries(entities as Record<string, any[]>).forEach(
          ([entityName, entityData]) => {
            performedActions[action][entityName] ??= []
            performedActions[action][entityName].push(...entityData)
          }
        )
      })
    }

    // FUTURE: We can make this performant by only aggregating the operations, but only executing them at the end.
    protected async assignCollectionRelation_(
      manager: SqlEntityManager,
      data: T,
      relation: EntityProperty
    ): Promise<{ entities: any[]; performedActions: PerformedActions }> {
      const dataForRelation = data[relation.name]

      const performedActions: PerformedActions = {
        created: {},
        updated: {},
        deleted: {},
      }

      // If the field is not set, we ignore it. Null and empty arrays are a valid input and are handled below
      if (dataForRelation === undefined) {
        return { entities: [], performedActions }
      }

      // Make sure the data is correctly initialized with IDs before using it
      const normalizedData = dataForRelation.map((normalizedItem) => {
        return this.getEntityWithId(manager, relation.type, normalizedItem)
      })

      if (relation.kind === ReferenceKind.MANY_TO_MANY) {
        const currentPivotColumn = relation.inverseJoinColumns[0]
        const parentPivotColumn = relation.joinColumns[0]

        if (!normalizedData.length) {
          await manager.nativeDelete(relation.pivotEntity, {
            [parentPivotColumn]: (data as any).id,
          })

          return { entities: normalizedData, performedActions }
        }

        const { performedActions: performedActions_ } = await this.upsertMany_(
          manager,
          relation.type,
          normalizedData,
          true
        )
        this.mergePerformedActions(performedActions, performedActions_)

        const pivotData = normalizedData.map((currModel) => {
          return {
            [parentPivotColumn]: (data as any).id,
            [currentPivotColumn]: currModel.id,
          }
        })

        await promiseAll([
          manager
            .qb(relation.pivotEntity)
            .insert(pivotData)
            .onConflict()
            .ignore()
            .execute(),
          manager.nativeDelete(relation.pivotEntity, {
            [parentPivotColumn]: (data as any).id,
            [currentPivotColumn]: {
              $nin: pivotData.map((d) => d[currentPivotColumn]),
            },
          }),
        ])

        return { entities: normalizedData, performedActions }
      }

      if (relation.kind === ReferenceKind.ONE_TO_MANY) {
        const joinColumns =
          relation.targetMeta?.properties[relation.mappedBy]?.joinColumns

        const joinColumnsConstraints = {}
        joinColumns?.forEach((joinColumn, index) => {
          const referencedColumnName = relation.referencedColumnNames[index]
          joinColumnsConstraints[joinColumn] = data[referencedColumnName]
        })

        const deletedRelations = await (
          manager.getTransactionContext() ?? manager.getKnex()
        )
          .queryBuilder()
          .from(relation.targetMeta!.collection)
          .delete()
          .where(joinColumnsConstraints)
          .whereNotIn(
            "id",
            normalizedData.map((d: any) => d.id)
          )
          .returning("id")

        if (deletedRelations.length) {
          performedActions.deleted[relation.type] ??= []
          performedActions.deleted[relation.type].push(
            ...deletedRelations.map((row) => ({ id: row.id }))
          )
        }

        if (normalizedData.length) {
          normalizedData.forEach((normalizedDataItem: any) => {
            Object.assign(normalizedDataItem, {
              ...joinColumnsConstraints,
            })
          })

          const { performedActions: performedActions_ } =
            await this.upsertMany_(manager, relation.type, normalizedData)
          this.mergePerformedActions(performedActions, performedActions_)
        }

        return { entities: normalizedData, performedActions }
      }

      return { entities: normalizedData, performedActions }
    }

    protected handleRelationAssignment_(
      relation: EntityProperty<any>,
      entryCopy: T
    ) {
      const originalData = entryCopy[relation.name]
      delete entryCopy[relation.name]

      if (originalData === undefined) {
        return undefined
      }

      // If it is a many-to-one we ensure the ID is set for when we want to set/unset an association
      if (relation.kind === ReferenceKind.MANY_TO_ONE) {
        if (originalData === null) {
          entryCopy[relation.joinColumns[0]] = null
          return null
        }

        // The relation can either be a primitive or the entity object, depending on how it's defined on the model
        let relationId
        if (isString(originalData)) {
          relationId = originalData
        } else if ("id" in originalData) {
          relationId = originalData.id
        }

        // We don't support creating many-to-one relations, so we want to throw if someone doesn't pass the ID
        if (!relationId) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Many-to-one relation ${relation.name} must be set with an ID`
          )
        }

        entryCopy[relation.joinColumns[0]] = relationId
        return originalData
      }

      return undefined
    }

    // Returns a POJO object with the ID populated from the entity model hooks
    protected getEntityWithId(
      manager: SqlEntityManager,
      entityName: string,
      data: any
    ): Record<string, any> & { id: string } {
      // We set the id to undefined to make sure the entity isn't fetched from the entity map if it is an update,
      // giving us incorrect data for the bignumberdata field (I though managed: false and persist: false would already do this)
      const created = manager.create(
        entityName,
        { ...data, id: undefined },
        {
          managed: false,
          persist: false,
        }
      )

      const resp = {
        // `create` will omit non-existent fields, but we want to pass the data the user provided through so the correct errors get thrown
        ...data,
        ...(created as any).__helper.__bignumberdata,
        id: data.id ?? (created as any).id,
      }

      // Non-persist relation columns should be removed before we do the upsert.
      Object.entries((created as any).__helper?.__meta.properties ?? {})
        .filter(
          ([_, propDef]: any) =>
            propDef.persist === false &&
            propDef.kind === ReferenceKind.MANY_TO_ONE
        )
        .forEach(([key]) => {
          delete resp[key]
        })

      return resp
    }

    protected async upsertMany_(
      manager: SqlEntityManager,
      entityName: string,
      entries: any[],
      skipUpdate: boolean = false
    ): Promise<{ orderedEntities: any[]; performedActions: PerformedActions }> {
      const selectQb = manager.qb(entityName)
      const existingEntities: any[] = await selectQb.select("*").where({
        id: { $in: entries.map((d) => d.id) },
      })

      const existingEntitiesMap = new Map(
        existingEntities.map((e) => [e.id, e])
      )

      const orderedEntities: T[] = []

      const performedActions = {
        created: {},
        updated: {},
        deleted: {},
      }

      const promises: Promise<any>[] = []
      const toInsert: any[] = []
      const toUpdate: any[] = []

      entries.forEach((data) => {
        const existingEntity = existingEntitiesMap.get(data.id)
        orderedEntities.push(data)
        if (existingEntity) {
          if (skipUpdate) {
            return
          }

          toUpdate.push(data)
        } else {
          toInsert.push(data)
        }
      })

      if (toInsert.length > 0) {
        let insertQb = manager.qb(entityName).insert(toInsert).returning("id")

        if (skipUpdate) {
          insertQb = insertQb.onConflict().ignore()
        }

        promises.push(
          insertQb.execute("all", true).then((res: { id: string }[]) => {
            performedActions.created[entityName] ??= []
            performedActions.created[entityName].push(
              ...res.map((data) => ({ id: data.id }))
            )
          })
        )
      }

      if (toUpdate.length > 0) {
        promises.push(
          manager
            .getDriver()
            .nativeUpdateMany(
              entityName,
              toUpdate.map((d) => ({ id: d.id })),
              toUpdate,
              { ctx: manager.getTransactionContext() }
            )
            .then((res) => {
              const updatedRows = res.rows ?? []
              const updatedRowsMap = new Map(updatedRows.map((d) => [d.id, d]))

              performedActions.updated[entityName] = toUpdate
                .map((d) => updatedRowsMap.get(d.id))
                .filter((row) => row !== undefined)
                .map((d) => ({ id: d.id }))
            })
        )
      }

      await promiseAll(promises)

      return { orderedEntities, performedActions }
    }

    async restore(
      filters:
        | string
        | string[]
        | DAL.FindOptions<T>["where"]
        | DAL.FindOptions<T>["where"][],
      sharedContext: Context = {}
    ): Promise<[InferRepositoryReturnType<T>[], Record<string, unknown[]>]> {
      if (Array.isArray(filters) && !filters.filter(Boolean).length) {
        return [[], {}]
      }

      if (!filters) {
        return [[], {}]
      }

      const normalizedFilters = this.normalizeFilters(filters)

      return await super.restore(normalizedFilters, sharedContext)
    }

    async softDelete(
      filters:
        | string
        | string[]
        | DAL.FindOptions<T>["where"]
        | DAL.FindOptions<T>["where"][],
      sharedContext: Context = {}
    ): Promise<[InferRepositoryReturnType<T>[], Record<string, unknown[]>]> {
      if (Array.isArray(filters) && !filters.filter(Boolean).length) {
        return [[], {}]
      }

      if (!filters) {
        return [[], {}]
      }

      const normalizedFilters = this.normalizeFilters(filters)

      return await super.softDelete(normalizedFilters, sharedContext)
    }

    private normalizeFilters(
      filters:
        | string
        | string[]
        | DAL.FindOptions<T>["where"]
        | DAL.FindOptions<T>["where"][]
    ): DAL.FindOptions<T>["where"] {
      const primaryKeys = MikroOrmAbstractBaseRepository_.retrievePrimaryKeys(
        this.entity
      )

      const filterArray = Array.isArray(filters) ? filters : [filters]
      const normalizedFilters: FilterQuery = {
        $or: filterArray.map((filter) => {
          // TODO: add support for composite keys
          if (isString(filter)) {
            return { [primaryKeys[0]]: filter }
          }

          return filter
        }),
      }

      return normalizedFilters as DAL.FindOptions<T>["where"]
    }
  }

  return MikroOrmAbstractBaseRepository_ as unknown as {
    new ({ manager }: { manager: any }): MikroOrmBaseRepository<T>
  }
}
