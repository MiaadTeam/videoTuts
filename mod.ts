import { ensureDir } from "https://deno.land/std@0.194.0/fs/ensure_dir.ts";
import {
  defaulted,
  enums,
  instance,
} from "../work/lesan/lesan-1/src/npmDeps.ts";
import { cityInp, countryInp, userInp } from "./declarations/selectInp.ts";
import {
  ActFn,
  array,
  boolean,
  Document,
  Filter,
  lesan,
  MongoClient,
  number,
  object,
  ObjectId,
  objectIdValidation,
  optional,
  RelationDataType,
  RelationSortOrderType,
  string,
} from "/Users/syd/work/lesan/lesan-1/mod.ts"; // Please replace `x.x.x` with the latest version in [releases](https://github.com/MiaadTeam/lesan/releases)
import { throwError } from "../work/lesan/lesan-1/src/utils/throwError.ts";

const coreApp = lesan();

const client = await new MongoClient("mongodb://127.0.0.1:27017/").connect();

const db = client.db("plainProject"); // change dbName to the appropriate name for your project.

coreApp.odm.setDb(db);

// ------------- Model Section -----------
// ------------- Country Model -----------
const locationPure = {
  name: string(),
  population: number(),
  abb: string(),
};

const countryRelations = {};

const countries = coreApp.odm.newModel(
  "country",
  locationPure,
  countryRelations,
);

// ------------- City Model -----------
const cityRelations = {
  country: {
    optional: false,
    schemaName: "country",
    type: "single" as RelationDataType,
    relatedRelations: {
      cities: {
        type: "multiple" as RelationDataType,
        limit: 3,
        sort: {
          field: "_id",
          order: "desc" as RelationSortOrderType,
        },
      },
      mostPopulatedCities: {
        type: "multiple" as RelationDataType,
        limit: 3,
        sort: {
          field: "population",
          order: "desc" as RelationSortOrderType,
        },
      },
      capital: {
        type: "single" as RelationDataType,
      },
    },
  },
};

const cities = coreApp.odm.newModel(
  "city",
  locationPure,
  cityRelations,
);

// ------------- User Model -----------
const userPure = {
  name: string(),
  age: number(),
  level: enums(["Admin", "Normal"]),
};

const users = coreApp.odm.newModel("user", userPure, {
  livedCities: {
    optional: false,
    schemaName: "city",
    type: "multiple",
    sort: {
      field: "_id",
      order: "desc",
    },
    relatedRelations: {
      users: {
        type: "multiple",
        limit: 5,
        sort: {
          field: "_id",
          order: "desc",
        },
      },
    },
  },

  mostLovedCity: {
    optional: true,
    schemaName: "city",
    type: "single",
    relatedRelations: {
      lovedByUsers: {
        type: "multiple",
        limit: 3,
        sort: {
          field: "_id",
          order: "desc",
        },
      },
    },
  },

  country: {
    optional: false,
    schemaName: "country",
    type: "single",
    relatedRelations: {
      users: {
        type: "multiple",
        limit: 5,
        sort: {
          field: "_id",
          order: "desc",
        },
      },
    },
  },
});

const files = coreApp.odm.newModel("file", {
  name: string(),
  type: string(),
  size: number(),
}, {
  uploader: {
    schemaName: "user",
    optional: false,
    type: "single",
    relatedRelations: {
      uploadedImages: {
        type: "multiple",
        limit: 5,
        sort: {
          field: "_id",
          order: "desc",
        },
      },
    },
  },
});

// ------------- Auth Sections -----------

const setUser = async () => {
  const context = coreApp.contextFns.getContextModel();
  const userId = context.Headers.get("userid");

  if (!userId) {
    throwError("You can not do this Act");
  }

  const foundedUser = await users.findOne({
    filters: { _id: new ObjectId(userId!) },
  });

  if (!foundedUser) {
    throwError("Can not find this user");
  }

  coreApp.contextFns.setContext({ user: foundedUser });
};

const checkLevel = async () => {
  const context = coreApp.contextFns.getContextModel();

  if (!context.user) {
    throwError("You most be loged in");
  }

  if (context.user.level === "Admin") {
    return;
  }

  coreApp.contextFns.addBodyToContext({
    ...context.body!,
    details: {
      ...context.body!.details,
      set: {
        ...context.body!.details.set,
        level: "Normal",
      },
    },
  });
};

const justAdmin = async () => {
  const context = coreApp.contextFns.getContextModel();

  if (!context.user) {
    throwError("You most be loged in");
  }

  if (context.user.level !== "Admin") {
    throwError("Just Admin can do this Act");
  }
};

// ------------- FN Sections -----------
// ------------- Country Validator -----------
const addCountryValidator = () => {
  return object({
    set: object(locationPure),
    get: coreApp.schemas.selectStruct("country", 1),
  });
};

// ------------- Country FN -----------
const addCountry: ActFn = async (body) => {
  const { name, abb, population } = body.details.set;
  return await countries.insertOne({
    doc: { name, abb, population },
    projection: body.details.get,
  });
};

// ------------- SET Country FN -----------
coreApp.acts.setAct({
  schema: "country",
  actName: "addCountry",
  validator: addCountryValidator(),
  fn: addCountry,
});

// ------------- addCountries Validator -----------
const addCountriesValidator = () => {
  return object({
    set: object({
      severalCountries: array(object({ ...locationPure })),
    }),
    get: coreApp.schemas.selectStruct("country", 1),
  });
};

// ------------- addCountries FN -----------
const addCountries: ActFn = async (body) => {
  const { severalCountries } = body.details.set;
  return await countries.insertMany({
    docs: severalCountries,
    projection: body.details.get,
  });
};

// ------------- SET addCountries FN -----------
coreApp.acts.setAct({
  schema: "country",
  actName: "addCountries",
  validator: addCountriesValidator(),
  fn: addCountries,
});

// ------------- ADD getCountries Validation -----------
const getCountiriesValidator = () => {
  return object({
    set: object({
      page: number(),
      take: number(),
      cityPopulation: optional(number()),
    }),
    get: coreApp.schemas.selectStruct<countryInp>("country", 1),
  });
};

// ------------- ADD getCountries FN -----------
const getCountiries: ActFn = async (body) => {
  let {
    set: { cityPopulation, page, take },
    get,
  } = body.details;

  page = page || 1;
  take = take || 10;
  const skip = take * (page - 1);
  const filters: Filter<Document> = {};
  cityPopulation &&
    (filters["mostPopulatedCities.population"] = { $gte: cityPopulation });

  return await countries.find({
    filters,
    projection: get,
  })
    .skip(skip)
    .limit(take)
    .toArray();
};

// ------------- SET getCountries FN -----------
coreApp.acts.setAct({
  schema: "country",
  actName: "getCountiries",
  validator: getCountiriesValidator(),
  fn: getCountiries,
});

// ------------- City Validator -----------
const addCityValidator = () => {
  return object({
    set: object({
      ...locationPure,
      countryId: objectIdValidation,
      isCapital: boolean(),
    }),
    get: coreApp.schemas.selectStruct("city", 1),
  });
};

// ------------- City FN -----------
const addCity: ActFn = async (body) => {
  const { name, abb, population, countryId, isCapital } = body.details.set;
  return await cities.insertOne({
    doc: { name, abb, population },
    relations: {
      country: {
        _ids: new ObjectId(countryId),
        relatedRelations: {
          cities: true,
          mostPopulatedCities: true,
          capital: isCapital ? true : false,
        },
      },
    },
    projection: body.details.get,
  });
};

// ------------- SET City FN -----------
coreApp.acts.setAct({
  schema: "city",
  actName: "addCity",
  validator: addCityValidator(),
  fn: addCity,
});

// ------------- addCities Validator -----------
const addCitiesValidator = () => {
  return object({
    set: object({
      severalCities: array(object({ ...locationPure })),
      countryId: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct("city", 1),
  });
};

// ------------- addCities FN -----------
const addCities: ActFn = async (body) => {
  const { severalCities, countryId } = body.details.set;
  return await cities.insertMany({
    docs: severalCities,
    relations: {
      country: {
        _ids: new ObjectId(countryId),
        relatedRelations: {
          cities: true,
          mostPopulatedCities: true,
          capital: false,
        },
      },
    },
    projection: body.details.get,
  });
};

// ------------- SET addCities FN -----------
coreApp.acts.setAct({
  schema: "city",
  actName: "addCities",
  validator: addCitiesValidator(),
  fn: addCities,
});

// ------------- Add User Validator -----------
const addUserValidator = () => {
  return object({
    set: object({
      name: string(),
      age: number(),
      level: defaulted(enums(["Admin", "Normal"]), "Normal"),
      country: objectIdValidation,
      lovedCity: objectIdValidation,
      livedCities: array(objectIdValidation),
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- Add User FN -----------
const addUser: ActFn = async (body) => {
  const { country, livedCities, name, age, lovedCity, level } =
    body.details.set;
  const obIdLivedCities = livedCities.map((lc: string) => new ObjectId(lc));

  return await users.insertOne({
    doc: { name, age, level },
    projection: body.details.get,
    relations: {
      country: {
        _ids: new ObjectId(country),
        relatedRelations: {
          users: true,
        },
      },
      livedCities: {
        _ids: obIdLivedCities,
        relatedRelations: {
          users: true,
        },
      },
      mostLovedCity: {
        _ids: new ObjectId(lovedCity),
        relatedRelations: {
          lovedByUsers: true,
        },
      },
    },
  });
};

// ------------- SET addUser FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "addUser",
  validator: addUserValidator(),
  fn: addUser,
  preValidation: [setUser, checkLevel],
  validationRunType: "create",
});

// ------------- Add AdminUser Validator -----------
const addAdminUserValidator = () => {
  return object({
    set: object({
      name: string(),
      age: number(),
      country: objectIdValidation,
      lovedCity: objectIdValidation,
      livedCities: array(objectIdValidation),
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- Add AdminUser FN -----------
const addAdminUser: ActFn = async (body) => {
  const { country, livedCities, name, age, lovedCity } = body.details.set;
  const obIdLivedCities = livedCities.map((lc: string) => new ObjectId(lc));

  const userCount = await users.countDocument({});

  if (userCount === 0) {
    return await users.insertOne({
      doc: { name, age, level: "Admin" },
      projection: body.details.get,
      relations: {
        country: {
          _ids: new ObjectId(country),
          relatedRelations: {
            users: true,
          },
        },
        livedCities: {
          _ids: obIdLivedCities,
          relatedRelations: {
            users: true,
          },
        },
        mostLovedCity: {
          _ids: new ObjectId(lovedCity),
          relatedRelations: {
            lovedByUsers: true,
          },
        },
      },
    });
  } else {
    throwError("Can not create admin user");
  }
};

// ------------- SET addAdminUser FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "addAdminUser",
  validator: addAdminUserValidator(),
  fn: addAdminUser,
});

// ------------- Add AddUserLivedCities Validator -----------
const addUserLivedCitiesValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      livedCities: array(objectIdValidation),
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- Add AddUserLivedCities FN -----------
const addUserLivedCities: ActFn = async (body) => {
  const { livedCities, _id } = body.details.set;
  const obIdLivedCities = livedCities.map((lc: string) => new ObjectId(lc));

  return await users.addRelation({
    filters: { _id: new ObjectId(_id) },
    projection: body.details.get,
    relations: {
      livedCities: {
        _ids: obIdLivedCities,
        relatedRelations: {
          users: true,
        },
      },
    },
  });
};

// ------------- SET AddUserLivedCities FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "addUserLivedCities",
  validator: addUserLivedCitiesValidator(),
  fn: addUserLivedCities,
});

// ------------- Add AddUserLovedCity Validator -----------
const addUserLovedCityValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      mostLovedCity: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- Add AddUserLovedCities FN -----------
const addUserLovedCity: ActFn = async (body) => {
  const { mostLovedCity, _id } = body.details.set;

  return await users.addRelation({
    filters: { _id: new ObjectId(_id) },
    projection: body.details.get,
    relations: {
      mostLovedCity: {
        _ids: new ObjectId(mostLovedCity),
        relatedRelations: {
          lovedByUsers: true,
        },
      },
    },
    replace: true,
  });
};

// ------------- SET AddUserLovedCities FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "addUserLovedCity",
  validator: addUserLovedCityValidator(),
  fn: addUserLovedCity,
});

// ------------- Remove RemoveUserLivedCities Validator -----------
const removeUserLivedCitiesValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      livedCities: array(objectIdValidation),
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- Remove RemoveUserLivedCities FN -----------
const removeUserLivedCities: ActFn = async (body) => {
  const { livedCities, _id } = body.details.set;
  const obIdLivedCities = livedCities.map((lc: string) => new ObjectId(lc));

  return await users.removeRelation({
    filters: { _id: new ObjectId(_id) },
    projection: body.details.get,
    relations: {
      livedCities: {
        _ids: obIdLivedCities,
        relatedRelations: {
          users: true,
        },
      },
    },
  });
};

// ------------- SET RemoveUserLivedCities FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "removeUserLivedCities",
  validator: removeUserLivedCitiesValidator(),
  fn: removeUserLivedCities,
});

// ------------- Remove RemoveUserCountry Validator -----------
const removeUserLovedCityValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      lovedCity: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- Remove RemoveUserLovedCity FN -----------
const removeUserLovedCity: ActFn = async (body) => {
  const { lovedCity, _id } = body.details.set;

  return await users.removeRelation({
    filters: { _id: new ObjectId(_id) },
    projection: body.details.get,
    relations: {
      mostLovedCity: {
        _ids: new ObjectId(lovedCity),
        relatedRelations: {
          lovedByUsers: true,
        },
      },
    },
  });
};

// ------------- SET RemoveUserLovedCity FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "removeUserLovedCity",
  validator: removeUserLovedCityValidator(),
  fn: removeUserLovedCity,
});

// ------------- ADD getUser Validation -----------
const getUserValidator = () => {
  return object({
    set: object({
      countryId: objectIdValidation,
      age: number(),
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- ADD getUser FN -----------
const getUser: ActFn = async (body) => {
  const {
    set: { age, countryId },
    get,
  } = body.details;

  return await users.findOne({
    filters: { "country._id": new ObjectId(countryId), age },
    projection: get,
  });
};

// ------------- SET getUser FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "getUser",
  validator: getUserValidator(),
  fn: getUser,
});

// ------------- ADD getUsers Validation -----------
const getUsersValidator = () => {
  return object({
    set: object({
      page: number(),
      take: number(),
      livedCities: optional(array(objectIdValidation)),
      age: optional(number()),
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// ------------- ADD getUsers FN -----------
const getUsers: ActFn = async (body) => {
  let {
    set: { age, livedCities, page, take },
    get,
  } = body.details;

  const addLiveCitiesFilter = (filters: Filter<Document>) => {
    const liIds = livedCities.map((li: string) => new ObjectId(li));
    filters["livedCities._id"] = { $in: liIds };
    return filters;
  };

  page = page || 1;
  take = take || 10;
  const skip = take * (page - 1);
  const filters: Filter<Document> = {};
  age && (filters.age = { $gte: age });
  livedCities && addLiveCitiesFilter(filters);

  return await users.find({
    filters,
    projection: get,
  })
    .skip(skip)
    .limit(take)
    .toArray();
};

// ------------- SET getUsers FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "getUsers",
  validator: getUsersValidator(),
  fn: getUsers,
});

// ------------- ADD getAgUsers Validation -----------
const getAgUsersValidator = () => {
  return object({
    set: object({
      page: number(),
      take: number(),
      livedCities: optional(array(objectIdValidation)),
      age: optional(number()),
      cityPopulation: optional(number()),
    }),
    get: coreApp.schemas.selectStruct<userInp>("user", {
      livedCities: { country: 1 },
    }),
  });
};

// ------------- ADD getAgUsers FN -----------
const getAgUsers: ActFn = async (body) => {
  let {
    set: { age, livedCities, cityPopulation, page, take },
    get,
  } = body.details;

  const addLiveCitiesFilter = (pipeline: Document[]) => {
    const liIds = livedCities.map((li: string) => new ObjectId(li));
    pipeline.push({ $match: { "livedCities._id": { $in: liIds } } });
    return pipeline;
  };

  const pipeline: Document[] = [];

  page = page || 1;
  take = take || 10;
  const skip = take * (page - 1);

  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: take });
  age && (pipeline.push({ $match: { age: { $gte: age } } }));
  livedCities && addLiveCitiesFilter(pipeline);
  cityPopulation &&
    (pipeline.push({
      $match: { "livedCities.population": { $gte: cityPopulation } },
    }));

  // const filters: Filter<Document> = {};

  return await users.aggregation({
    pipeline,
    projection: get,
  })
    .skip(skip)
    .limit(take)
    .toArray();
};

// ------------- SET getAgUsers FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "getAgUsers",
  validator: getAgUsersValidator(),
  fn: getAgUsers,
});

// ------------- ADD getAgUser Validation -----------
const getAgUserValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct<userInp>("user", 3),
  });
};

// ------------- ADD getAgUser FN -----------
const getAgUser: ActFn = async (body) => {
  const {
    set: { _id },
    get,
  } = body.details;

  const pipeline: Document[] = [{ $match: { _id: new ObjectId(_id) } }];

  // const filters: Filter<Document> = {};

  return await users.aggregation({
    pipeline,
    projection: get,
  })
    .toArray();
};

// ------------- SET getAgUser FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "getAgUser",
  validator: getAgUserValidator(),
  fn: getAgUser,
});

// ------------- ADD updateUser Validation -----------
const updateUserValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      name: string(),
      age: number(),
    }),
    get: coreApp.schemas.selectStruct<userInp>("user", 1),
  });
};

// ------------- ADD updateUser FN -----------
const updateUser: ActFn = async (body) => {
  const {
    set: { _id, name, age },
    get,
  } = body.details;

  return await users.findOneAndUpdate({
    filter: { _id: new ObjectId(_id) },
    update: { $set: { name, age } },
    projection: get,
  });
};

// ------------- SET updateUser FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "updateUser",
  validator: updateUserValidator(),
  fn: updateUser,
});

// ------------- ADD updateCity Validation -----------
const updateCityValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      name: optional(string()),
      abb: optional(string()),
      population: optional(number()),
    }),
    get: coreApp.schemas.selectStruct<cityInp>("city", 1),
  });
};

// ------------- ADD updateCity FN -----------
const updateCity: ActFn = async (body) => {
  const {
    set: { _id, name, abb, population },
    get,
  } = body.details;

  const updateObj: Document = {};
  name && (updateObj.name = name);
  abb && (updateObj.abb = abb);
  population && (updateObj.population = population);

  return await cities.findOneAndUpdate({
    filter: { _id: new ObjectId(_id) },
    update: { $set: updateObj },
    projection: get,
  });
};

// ------------- SET updateCity FN -----------
coreApp.acts.setAct({
  schema: "city",
  actName: "updateCity",
  validator: updateCityValidator(),
  fn: updateCity,
});

// ------------- ADD updateCountry Validation -----------
const updateCountryValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      name: optional(string()),
      abb: optional(string()),
      population: optional(number()),
    }),
    get: coreApp.schemas.selectStruct<countryInp>("country", 1),
  });
};

// ------------- ADD updateCountry FN -----------
const updateCountry: ActFn = async (body) => {
  const {
    set: { _id, name, abb, population },
    get,
  } = body.details;

  const updateObj: Document = {};
  name && (updateObj.name = name);
  abb && (updateObj.abb = abb);
  population && (updateObj.population = population);

  return await countries.findOneAndUpdate({
    filter: { _id: new ObjectId(_id) },
    update: { $set: updateObj },
    projection: get,
  });
};

// ------------- SET updateCountry FN -----------
coreApp.acts.setAct({
  schema: "country",
  actName: "updateCountry",
  validator: updateCountryValidator(),
  fn: updateCountry,
});

// ------------- ADD deleteUser Validation -----------
const deleteUserValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
    }),
    get: object({
      success: optional(enums([0, 1])),
    }),
  });
};

// ------------- ADD deleteUser FN -----------
const deleteUser: ActFn = async (body) => {
  const {
    set: { _id },
    get,
  } = body.details;

  return await users.deleteOne({
    filter: { _id: new ObjectId(_id) },
  });
};

// ------------- SET deleteUser FN -----------
coreApp.acts.setAct({
  schema: "user",
  actName: "deleteUser",
  validator: deleteUserValidator(),
  fn: deleteUser,
});

// ------------- ADD deleteCity Validation -----------
const deleteCityValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
    }),
    get: object({
      success: optional(enums([0, 1])),
    }),
  });
};

// ------------- ADD deleteCity FN -----------
const deleteCity: ActFn = async (body) => {
  const {
    set: { _id },
    get,
  } = body.details;

  return await cities.deleteOne({
    filter: { _id: new ObjectId(_id) },
    hardCascade: true,
  });
};

// ------------- SET deleteCity FN -----------
coreApp.acts.setAct({
  schema: "city",
  actName: "deleteCity",
  validator: deleteCityValidator(),
  fn: deleteCity,
});

// ------------- ADD deleteCountry Validation -----------
const deleteCountryValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
    }),
    get: object({
      success: optional(enums([0, 1])),
    }),
  });
};

// ------------- ADD deleteCountry FN -----------
const deleteCountry: ActFn = async (body) => {
  const {
    set: { _id },
    get,
  } = body.details;

  return await countries.deleteOne({
    filter: { _id: new ObjectId(_id) },
    hardCascade: true,
  });
};

// ------------- SET deleteCountry FN -----------
coreApp.acts.setAct({
  schema: "country",
  actName: "deleteCountry",
  validator: deleteCountryValidator(),
  fn: deleteCountry,
  preAct: [setUser, justAdmin],
});

// ------------- ADD uploadFile Validation -----------
const uploadFileValidator = () => {
  return object({
    set: object({
      userId: objectIdValidation,
      formData: instance(FormData),
    }),
    get: coreApp.schemas.selectStruct("file", 1),
  });
};

// ------------- ADD uploadFile FN -----------
const uploadFile: ActFn = async (body) => {
  const formData: FormData = body.details.set.formData;

  const image: File = formData.get("image") as File;

  await ensureDir("./images");
  await Deno.writeFile(
    `./Images/${new ObjectId()}-${image.name}`,
    image.stream(),
  );

  return await files.insertOne({
    doc: { name: image.name, type: image.type, size: image.size },
    relations: {
      uploader: {
        _ids: new ObjectId(body.details.set.userId),
        relatedRelations: {
          uploadedImages: true,
        },
      },
    },
    projection: body.details.get,
  });
};

// ------------- SET uploadFile FN -----------
coreApp.acts.setAct({
  schema: "file",
  actName: "uploadFile",
  validator: uploadFileValidator(),
  fn: uploadFile,
});

coreApp.runServer({
  port: 1366,
  typeGeneration: false,
  playground: true,
  staticPath: ["/images"],
  cors: ["http://www.nothing.com"],
});
