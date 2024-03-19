
    export type countryInp = {
      
      cities?: number | cityInp
mostPopulatedCities?: number | cityInp
capital?: number | cityInp
users?: number | userInp
    }

    export type cityInp = {
      country?: number | countryInp
      users?: number | userInp
lovedByUsers?: number | userInp
    }

    export type userInp = {
      livedCities?: number | cityInp
mostLovedCity?: number | cityInp
country?: number | countryInp
      
    }
